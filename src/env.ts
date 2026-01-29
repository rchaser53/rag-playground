import path from "node:path";

export const env = {
  port: Number(process.env.PORT ?? 8787),

  // Gemini API のみ使用する（OpenAI/localhash は使用しない）
  llmProvider: "gemini" as const,
  embeddingsProvider: "gemini" as const,

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiChatModel: process.env.GEMINI_CHAT_MODEL ?? "gemini-1.5-flash",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",

  // Embeddingsテーブルのmodelカラムに入れる識別子（プロバイダ切替時に衝突しないようにする）
  embeddingsModelKey: `gemini:${process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004"}`,

  dataDir: process.env.DATA_DIR ? process.env.DATA_DIR : path.join(process.cwd(), "data"),
};
