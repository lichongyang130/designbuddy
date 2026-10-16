export interface ToolCall {
  toolId: string;
  params: unknown;
}

export class ToolExecutor {
  private tools = new Map<string, Function>();

  register(toolId: string, handler: Function) {
    this.tools.set(toolId, handler);
  }

  async execute(call: ToolCall) {
    const tool = this.tools.get(call.toolId);
    if (!tool) throw new Error(`Tool ${call.toolId} not found`);
    return tool(call.params);
  }
}
