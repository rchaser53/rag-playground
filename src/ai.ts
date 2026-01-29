import { env } from "./env.js";
import { embedTextGemini, answerWithContextGemini, getGeminiEmbeddingModelInUse } from "./gemini.js";

export type RuntimeModelInfo = {
  llm: {
    provider: typeof env.llmProvider;
    model: string;
  };
  embeddings: {
    provider: typeof env.embeddingsProvider;
    model: string;
    modelKey: string;
  };
};

export function embeddingsEnabled(): boolean {
  return Boolean(env.geminiApiKey);
}

export function llmEnabled(): boolean {
  return Boolean(env.geminiApiKey);
}

export function getRuntimeModelInfo(): RuntimeModelInfo {
  const llmModel = env.geminiChatModel;
  const embModel = getGeminiEmbeddingModelInUse();

  return {
    llm: { provider: env.llmProvider, model: llmModel },
    embeddings: {
      provider: env.embeddingsProvider,
      model: embModel,
      modelKey: env.embeddingsModelKey,
    },
  };
}

export async function embedText(input: string): Promise<number[] | null> {
  const s = (input ?? "").trim();
  if (!s) return null;

  return await embedTextGemini(s);
}

export async function answerWithContext(args: {
  question: string;
  dateFilterISO: string | null;
  contexts: Array<{ date: string; title: string; content: string }>;
}): Promise<string | null> {
  return await answerWithContextGemini(args);
}
