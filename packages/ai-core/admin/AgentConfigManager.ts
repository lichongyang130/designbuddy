export class AgentConfigManager {
  private configs = new Map<string, unknown>();
  update(agentId: string, config: unknown) { this.configs.set(agentId, config); }
  get(agentId: string) { return this.configs.get(agentId); }
}
