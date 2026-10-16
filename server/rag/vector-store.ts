export interface VectorItem {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export class VectorStore {
  private readonly items = new Map<string, VectorItem>();

  add(item: VectorItem): void {
    if (!item.id.trim()) throw new Error('Vector item id is required');
    if (!item.vector.length || item.vector.some((value) => !Number.isFinite(value))) {
      throw new Error('Vector item must contain finite numeric values');
    }
    this.items.set(item.id, { ...item, vector: [...item.vector] });
  }

  remove(id: string): boolean {
    return this.items.delete(id);
  }

  search(vector: number[], limit = 10): VectorItem[] {
    if (!vector.length || vector.some((value) => !Number.isFinite(value))) {
      throw new Error('Query vector must contain finite numeric values');
    }
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Limit must be a positive integer');

    return [...this.items.values()]
      .map((item) => ({ item, score: this.cosineSimilarity(vector, item.vector) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  }
}
