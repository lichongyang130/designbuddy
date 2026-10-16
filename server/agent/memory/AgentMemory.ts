export interface MemoryItem {
  key: string;
  value: unknown;
  createdAt: number;
}

export class AgentMemory {
  private store = new Map<string, MemoryItem>();

  save(key: string, value: unknown) {
    this.store.set(key, {
      key,
      value,
      createdAt: Date.now()
    });
  }

  get(key: string) {
    return this.store.get(key);
  }

  clear() {
    this.store.clear();
  }
}
