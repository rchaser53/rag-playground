import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Chroma } from '@langchain/community/vectorstores/chroma';
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
  const splitDocs = await splitter.splitDocuments(docs);

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
