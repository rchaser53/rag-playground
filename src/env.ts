import path from "node:path";

type LlmProvider = "openai" | "gemini";
type EmbeddingsProvider = "openai" | "gemini" | "localhash";

function pickLlmProvider(v: string | undefined): LlmProvider {
  return v === "gemini" ? "gemini" : "openai";
}

function pickEmbeddingsProvider(v: string | undefined): EmbeddingsProvider {
  if (v === "gemini") return "gemini";
  if (v === "localhash") return "localhash";
  return "openai";
}

export const env = {
  port: Number(process.env.PORT ?? 8787),

  llmProvider: pickLlmProvider(process.env.LLM_PROVIDER),
  embeddingsProvider: pickEmbeddingsProvider(process.env.EMBEDDINGS_PROVIDER),

  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiEmbedModel: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small",
  openaiChatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiChatModel: process.env.GEMINI_CHAT_MODEL ?? "gemini-1.5-flash",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",

  // Embeddingsテーブルのmodelカラムに入れる識別子（プロバイダ切替時に衝突しないようにする）
  embeddingsModelKey:
    pickEmbeddingsProvider(process.env.EMBEDDINGS_PROVIDER) === "gemini"
      ? `gemini:${process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004"}`
      : pickEmbeddingsProvider(process.env.EMBEDDINGS_PROVIDER) === "localhash"
        ? "localhash:v1"
        : `openai:${process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small"}`,

  dataDir: process.env.DATA_DIR ? process.env.DATA_DIR : path.join(process.cwd(), "data"),
};
