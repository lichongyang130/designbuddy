export interface EmbeddingResult {
  vector: number[];
  text: string;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

/**
 * Uses a configured embedding provider when supplied; otherwise falls back to a
 * deterministic hashed-token vector. This fallback supports lexical retrieval,
 * not semantic quality comparable to a trained embedding model.
 */
export class EmbeddingService {
  constructor(
    private readonly provider?: EmbeddingProvider,
    private readonly dimensions = 384,
  ) {
    if (!Number.isInteger(dimensions) || dimensions < 32) {
      throw new Error('Embedding dimensions must be an integer >= 32');
    }
  }

  async createEmbedding(text: string): Promise<EmbeddingResult> {
    const normalized = text.trim();
    if (!normalized) throw new Error('Cannot create an embedding for empty text');

    const vector = this.provider
      ? await this.provider.embed(normalized)
      : this.localEmbedding(normalized);

    if (!Array.isArray(vector) || vector.length === 0 || vector.some((n) => !Number.isFinite(n))) {
      throw new Error('Embedding provider returned an invalid vector');
    }
    return { vector, text };
  }

  private localEmbedding(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = text.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
    for (const token of tokens) {
      let hash = 2166136261;
      for (let i = 0; i < token.length; i++) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const index = (hash >>> 0) % this.dimensions;
      vector[index] += token.length > 3 ? 1.5 : 1;
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) vector[i] /= magnitude;
    }
    return vector;
  }
}
