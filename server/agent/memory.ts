export interface MemoryItem {
  key: string;
  value: string;
}

export class AgentMemory {
  private store = new Map<string,string>();

  save(item: MemoryItem) {
    this.store.set(item.key, item.value);
  }

  get(key:string) {
    return this.store.get(key);
  }
}
