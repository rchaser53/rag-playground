import { Chroma } from '@langchain/community/vectorstores/chroma';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

import { config } from '../config.js';
import { getEmbeddingsWithFallback } from '../embeddings.js';
import { listRagItems } from './store.js';

export async function reindexAllRagItems(): Promise<{ items: number; chunks: number }>
{
  const items = await listRagItems();
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 900, chunkOverlap: 150 });

  const documents = [] as any[];
  for (const item of items) {
    const splits = await splitter.createDocuments([
      item.content
    ], [
      {
        ragId: item.id,
        title: item.title,
        source: item.source,
        tags: item.tags
      }
    ]);

    splits.forEach((d, i) => {
      d.metadata = { ...d.metadata, chunk: i };
      documents.push(d);
    });
  }

  const embeddings = getEmbeddingsWithFallback();
  const vectorStore = await Chroma.fromExistingCollection(embeddings, {
    collectionName: config.chromaCollection,
    url: config.chromaUrl
  }).catch(async () => {
    return Chroma.fromDocuments([], embeddings, {
      collectionName: config.chromaCollection,
      url: config.chromaUrl
    });
  });

  // 全入れ替え（簡単・確実）。大規模になったら差分更新にできます。
  try {
    await (vectorStore as any).delete({ deleteAll: true });
  } catch {
    // deleteAll非対応の実装もあるため無視
  }

  const ids = documents.map((d) => `${d.metadata.ragId}:${d.metadata.chunk}`);
  if (documents.length > 0) {
    await vectorStore.addDocuments(documents as any, { ids } as any);
  }

  return { items: items.length, chunks: documents.length };
}

