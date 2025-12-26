import 'dotenv/config';

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  chatModel: process.env.CHAT_MODEL ?? 'gpt-4o-mini',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  chromaUrl: process.env.CHROMA_URL ?? 'http://localhost:8000',
  chromaCollection: process.env.CHROMA_COLLECTION ?? 'shikiho',
  shikihoRawDir: process.env.SHIKIHO_RAW_DIR ?? './data/shikiho/raw'
};
