export class RuntimeMemoryBridge {
  private memory = new Map<string, unknown>();

  save(key: string, value: unknown) {
    this.memory.set(key, value);
  }

  load<T = unknown>(key: string): T | undefined {
    return this.memory.get(key) as T | undefined;
  }
}
