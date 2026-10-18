export class AgentInstanceManager {
  private instances = new Map<string, string>();
  create(id: string) { this.instances.set(id, 'running'); }
  status(id: string) { return this.instances.get(id); }
}
