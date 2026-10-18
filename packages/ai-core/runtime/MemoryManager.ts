export interface MemoryRecord {
  key: string;
  value: unknown;
  type: 'short-term' | 'long-term';
}

export class MemoryManager {
  private memory = new Map<string, MemoryRecord>();

  save(record: MemoryRecord) {
    this.memory.set(record.key, record);
    return record;
  }

  get(key: string) {
    return this.memory.get(key);
  }

  list() {
    return Array.from(this.memory.values());
  }
}
