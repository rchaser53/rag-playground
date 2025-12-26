import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Embeddings } from '@langchain/core/embeddings';

import { serialize, withRetry } from './retry.js';

class LocalHashEmbeddings extends Embeddings {
  constructor(private vectorSize: number = 256) {
    super({});
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.all(documents.map((doc) => this.embedQuery(doc)));
  }

  async embedQuery(text: string): Promise<number[]> {
    const vector = new Array<number>(this.vectorSize).fill(0);
    if (!text) return vector;

    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0;
      vector[code % this.vectorSize] += 1;
    }

    const sum = vector.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (let i = 0; i < vector.length; i += 1) vector[i] /= sum;
    }

    return vector;
  }
}

class RateLimitedEmbeddings extends Embeddings {
  constructor(
    private inner: Embeddings,
    private batchSize: number = Number(process.env.EMBEDDINGS_BATCH_SIZE ?? 8),
    private spacingMs: number = Number(process.env.REQUEST_SPACING_MS ?? 0)
  ) {
    super({});
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const out: number[][] = [];
    const size = Number.isFinite(this.batchSize) && this.batchSize > 0 ? this.batchSize : 8;

    for (let i = 0; i < documents.length; i += size) {
      const batch = documents.slice(i, i + size);
      const vectors = await serialize(() => withRetry(() => this.inner.embedDocuments(batch), { spacingMs: this.spacingMs }));
      out.push(...vectors);
    }

    return out;
  }

  async embedQuery(text: string): Promise<number[]> {
    return serialize(() => withRetry(() => this.inner.embedQuery(text), { spacingMs: this.spacingMs }));
  }
}

function isRateLimitOrQuotaLikeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: unknown; message?: unknown; name?: unknown };
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  const name = typeof anyErr.name === 'string' ? anyErr.name : '';
  return (
    anyErr.status === 429 ||
    name.includes('InsufficientQuota') ||
    message.includes('exceeded your current quota') ||
    message.includes('InsufficientQuota') ||
    message.includes('Quota exceeded') ||
    message.includes('RESOURCE_EXHAUSTED')
  );
}

export function getEmbeddings(): Embeddings {
  const provider = (process.env.EMBEDDINGS_PROVIDER ?? 'gemini').toLowerCase();

  if (provider === 'local' || provider === 'localhash') {
    return new LocalHashEmbeddings();
  }

  if (provider === 'gemini' || provider === 'google' || provider === 'google-genai') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing env var: GEMINI_API_KEY (required for EMBEDDINGS_PROVIDER=gemini)');
    // Model name examples: text-embedding-004
    const model = process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004';
    return new RateLimitedEmbeddings(new GoogleGenerativeAIEmbeddings({ apiKey, model }));
  }

  throw new Error(`Unsupported EMBEDDINGS_PROVIDER: ${provider}. Set EMBEDDINGS_PROVIDER=gemini or localhash`);
}

export function getEmbeddingsWithFallback(errFromFirstAttempt?: unknown): Embeddings {
  if (errFromFirstAttempt && isRateLimitOrQuotaLikeError(errFromFirstAttempt)) {
    console.warn(
      'Embeddings が quota/rate limit で失敗したため、ローカル簡易Embedding(localhash)にフォールバックします。'
    );
    return new LocalHashEmbeddings();
  }
  return getEmbeddings();
}
