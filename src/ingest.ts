import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Chroma } from '@langchain/community/vectorstores/chroma';
import { ChromaClient } from 'chromadb';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';

import { config } from './config.js';
import { getEmbeddingsWithFallback } from './embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function absFromRepo(relativePath: string) {
  return path.resolve(__dirname, '..', relativePath);
}

async function main() {
  const argv = process.argv.slice(2);
  const resetCollection =
    argv.includes('--reset-collection') || argv.includes('--recreate-collection') || argv.includes('--drop-collection');

  if (resetCollection) {
    const client = new ChromaClient({ path: config.chromaUrl });
    console.log(
      `[ingest] Reset requested: deleting Chroma collection name="${config.chromaCollection}" at ${config.chromaUrl}`
    );
    try {
      await client.deleteCollection({ name: config.chromaCollection });
      console.log(`[ingest] Deleted collection name="${config.chromaCollection}"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[ingest] Failed to delete collection name="${config.chromaCollection}" (continuing anyway): ${message}`
      );
    }
  }

  const rawDir = absFromRepo(config.shikihoRawDir);

  const loader = new DirectoryLoader(rawDir, {
    '.txt': (p: string) => new TextLoader(p),
    '.md': (p: string) => new TextLoader(p)
  });

  const docs = await loader.load();
  if (docs.length === 0) {
    throw new Error(
      `No documents found in ${rawDir}. Put your Shikiho-derived text files under data/shikiho/raw/.`
    );
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 150
  });
  const splitDocsRaw = await splitter.splitDocuments(docs);
  const splitDocs = splitDocsRaw.filter((d) => (d.pageContent ?? '').trim().length > 0);
  if (splitDocs.length === 0) {
    throw new Error(
      `All chunks were empty after splitting. Check input files under ${rawDir} (they may contain only whitespace).`
    );
  }

  let vectorStore: Chroma;
  try {
    const embeddings = getEmbeddingsWithFallback();
    vectorStore = await Chroma.fromDocuments(splitDocs, embeddings, {
      url: config.chromaUrl,
      collectionName: config.chromaCollection
    });
  } catch (err) {
    const embeddings = getEmbeddingsWithFallback(err);
    vectorStore = await Chroma.fromDocuments(splitDocs, embeddings, {
      url: config.chromaUrl,
      collectionName: config.chromaCollection
    });
  }

  const count = vectorStore.collection ? await vectorStore.collection.count() : undefined;
  console.log(
    `Ingested into Chroma collection="${config.chromaCollection}": chunks=${splitDocs.length}` +
      (count !== undefined ? ` count=${count}` : '')
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
