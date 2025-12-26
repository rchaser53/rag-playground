import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { Chroma } from '@langchain/community/vectorstores/chroma';
import type { DocumentInterface } from '@langchain/core/documents';

import { config } from './config.js';
import { getEmbeddingsWithFallback } from './embeddings.js';
import { getChatModel } from './llm.js';

function isQuotaLikeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: unknown; message?: unknown; name?: unknown };
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  const name = typeof anyErr.name === 'string' ? anyErr.name : '';
  return (
    anyErr.status === 429 ||
    name.includes('InsufficientQuota') ||
    message.includes('exceeded your current quota') ||
    message.includes('InsufficientQuota') ||
    message.includes('Quota exceeded') ||
    message.includes('rate-limits')
  );
}

function getLlmProvider(): string {
  return (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();
}

function isGeminiNoQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: unknown; message?: unknown };
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  // Example: "Quota exceeded for metric: ... free_tier_requests, limit: 0"
  return anyErr.status === 429 && message.includes('limit: 0');
}

function isModelNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: unknown; message?: unknown; code?: unknown; error?: unknown };
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  const code = typeof anyErr.code === 'string' ? anyErr.code : '';
  const nestedCode =
    anyErr.error && typeof anyErr.error === 'object' && typeof (anyErr.error as any).code === 'string'
      ? ((anyErr.error as any).code as string)
      : '';
  return (
    anyErr.status === 404 ||
    code === 'model_not_found' ||
    nestedCode === 'model_not_found' ||
    message.includes('model') && message.includes('does not exist')
  );
}

async function main() {
  const baseEmbeddings = getEmbeddingsWithFallback();

  const baseVectorStore = await Chroma.fromExistingCollection(baseEmbeddings, {
    url: config.chromaUrl,
    collectionName: config.chromaCollection
  });

  const baseRetriever = baseVectorStore.asRetriever(4);

  const llm = getChatModel();

  async function answerWithRag(question: string): Promise<string> {
    let docs: DocumentInterface[];
    try {
      docs = (await baseRetriever.invoke(question)) as DocumentInterface[];
    } catch (err) {
      const fallbackEmbeddings = getEmbeddingsWithFallback(err);
      const fallbackVectorStore = await Chroma.fromExistingCollection(fallbackEmbeddings, {
        url: config.chromaUrl,
        collectionName: config.chromaCollection
      });
      const fallbackRetriever = fallbackVectorStore.asRetriever(4);
      docs = (await fallbackRetriever.invoke(question)) as DocumentInterface[];
    }
    const context = docs.map((d, i) => `[#${i + 1}] ${d.pageContent}`).join('\n\n');

    const prompt =
      'あなたは有能なアシスタントです。与えられたContextに基づいて日本語で回答してください。\n' +
      'Contextが不足している場合は、その旨を述べて追加情報を提案してください。\n' +
      '注意: Contextの全文をそのまま貼り付けたり、長文引用で埋めないでください。必要な箇所のみ要点をまとめ、根拠として [#] を短く引用してください。\n\n' +
      `Context:\n${context}\n\nQuestion:\n${question}`;

    try {
      const res = await llm.invoke(prompt);
      // Returns an AIMessage-like object
      return typeof (res as any).content === 'string' ? (res as any).content : JSON.stringify(res);
    } catch (err) {
      if (isQuotaLikeError(err)) {
        if (getLlmProvider() === 'gemini' || getLlmProvider() === 'google' || getLlmProvider() === 'google-genai') {
          const extra = isGeminiNoQuotaError(err)
            ? '（Gemini APIの無料枠が0になっている/請求設定が未設定の可能性があります。Google AI Studio/Cloud側でGemini APIの利用設定・請求設定を確認してください）\n'
            : '';
          return (
            `（Geminiの利用枠/レート制限のため、LLM回答は省略します。検索で取れたContextを表示します）\n${extra}\n` +
            context
          );
        }
      }
      if (isModelNotFoundError(err)) {
        if (getLlmProvider() === 'gemini' || getLlmProvider() === 'google' || getLlmProvider() === 'google-genai') {
          return (
            '（GEMINI_CHAT_MODELで指定したモデルが見つからない/権限がないため、LLM回答は省略します。検索で取れたContextを表示します）\n' +
            'ヒント: GEMINI_CHAT_MODEL を `gemini-flash-latest` などに変更するか、ListModelsで利用可能モデルを確認してください。\n\n' +
            context
          );
        }
      }
      throw err;
    }
  }

  const argv = process.argv.slice(2);
  const argQuestion = (() => {
    // Usage examples:
    //   tsx src/query.ts --question "..."
    //   tsx src/query.ts "..."
    const qIndex = argv.findIndex((a) => a === '--question' || a === '-q');
    if (qIndex >= 0) {
      const rest = argv.slice(qIndex + 1).filter((a) => !a.startsWith('-'));
      return rest.join(' ').trim();
    }
    const positional = argv.filter((a) => !a.startsWith('-')).join(' ').trim();
    return positional;
  })();

  // Non-interactive one-shot mode: avoid prompting for terminal input.
  if (argQuestion) {
    const answer = await answerWithRag(argQuestion);
    console.log(answer);
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      let question: string;
      try {
        question = (await rl.question('質問> ')).trim();
      } catch {
        break;
      }
      if (!question) continue;
      if (question.toLowerCase() === 'exit' || question === '終了') break;

      const answer = await answerWithRag(question);
      console.log(`\n${answer}\n`);
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
