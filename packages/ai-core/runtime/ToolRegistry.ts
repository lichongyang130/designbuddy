export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  execute: (args: unknown) => Promise<unknown>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  get(name: string) {
    return this.tools.get(name);
  }

  list() {
    return [...this.tools.values()];
  }
}
