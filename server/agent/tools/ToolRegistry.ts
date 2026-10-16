export interface AgentTool {
  name: string;
  description: string;
  execute(input: unknown): Promise<unknown>;
}

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string) {
    return this.tools.get(name);
  }

  list() {
    return Array.from(this.tools.values());
  }
}
