import { reindexAllRagItems } from './rag/indexer.js';

async function main() {
  const result = await reindexAllRagItems();
  console.log(`[reindex] items=${result.items} chunks=${result.chunks}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
