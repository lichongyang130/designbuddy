export class AgentRuntimeManager {
  private runtimes = new Map<string, unknown>();
  register(id: string, runtime: unknown) { this.runtimes.set(id, runtime); }
  remove(id: string) { this.runtimes.delete(id); }
  get(id: string) { return this.runtimes.get(id); }
}
