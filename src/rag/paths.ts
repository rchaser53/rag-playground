import path from 'node:path';

export function getRagDataDir(): string {
  return process.env.RAG_DATA_DIR
    ? path.resolve(process.env.RAG_DATA_DIR)
    : path.resolve(process.cwd(), 'data', 'rag');
}

export function getRagItemsPath(): string {
  return path.join(getRagDataDir(), 'items.json');
}
