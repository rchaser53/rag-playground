import crypto from "node:crypto";
import { env } from "./env.js";
import { embedText as embedTextOpenAI, answerWithContext as answerWithContextOpenAI } from "./openai.js";
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
  if (env.embeddingsProvider === "localhash") return true;
  if (env.embeddingsProvider === "openai") return Boolean(env.openaiApiKey);
  if (env.embeddingsProvider === "gemini") return Boolean(env.geminiApiKey);
  return false;
}

export function llmEnabled(): boolean {
  if (env.llmProvider === "openai") return Boolean(env.openaiApiKey);
  if (env.llmProvider === "gemini") return Boolean(env.geminiApiKey);
  return false;
}

export function getRuntimeModelInfo(): RuntimeModelInfo {
  const llmModel = env.llmProvider === "gemini" ? env.geminiChatModel : env.openaiChatModel;

  let embModel = "";
  if (env.embeddingsProvider === "gemini") embModel = getGeminiEmbeddingModelInUse();
  else if (env.embeddingsProvider === "localhash") embModel = "localhash:v1";
  else embModel = env.openaiEmbedModel;

  return {
    llm: { provider: env.llmProvider, model: llmModel },
    embeddings: {
      provider: env.embeddingsProvider,
      model: embModel,
      modelKey: env.embeddingsModelKey,
    },
  };
}

function embedTextLocalhash(input: string, dims = 256): number[] {
  const vec = new Array<number>(dims).fill(0);
  let filled = 0;
  let counter = 0;

  while (filled < dims) {
    const h = crypto
      .createHash("sha256")
      .update(String(counter))
      .update("|")
      .update(input)
      .digest();
    for (const b of h) {
      if (filled >= dims) break;
      // [-0.5, 0.5]
      vec[filled] = b / 255 - 0.5;
      filled++;
    }
    counter++;
  }

  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;

  return vec;
}

export async function embedText(input: string): Promise<number[] | null> {
  const s = (input ?? "").trim();
  if (!s) return null;

  switch (env.embeddingsProvider) {
    case "gemini":
      return await embedTextGemini(s);
    case "localhash":
      return embedTextLocalhash(s);
    case "openai":
    default:
      return await embedTextOpenAI(s);
  }
}

export async function answerWithContext(args: {
  question: string;
  dateFilterISO: string | null;
  contexts: Array<{ date: string; title: string; content: string }>;
}): Promise<string | null> {
  switch (env.llmProvider) {
    case "gemini":
      return await answerWithContextGemini(args);
    case "openai":
    default:
      return await answerWithContextOpenAI(args);
  }
}
