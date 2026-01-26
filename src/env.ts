import path from "node:path";

export const env = {
  port: Number(process.env.PORT ?? 8787),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiEmbedModel: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small",
  openaiChatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
  dataDir: process.env.DATA_DIR ? process.env.DATA_DIR : path.join(process.cwd(), "data"),
};
