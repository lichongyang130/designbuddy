export interface AgentTool {
  name: string;
  execute(input: unknown): Promise<unknown>;
}

export class AgentExecutor {
  async execute(tool: AgentTool, input: unknown) {
    return tool.execute(input);
  }
}
