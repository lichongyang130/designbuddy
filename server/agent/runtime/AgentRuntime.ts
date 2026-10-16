export interface AgentContext {
  sessionId: string;
  userId?: string;
  input: string;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  output: string;
  toolsUsed: string[];
}

export class AgentRuntime {
  async execute(context: AgentContext): Promise<AgentResult> {
    return {
      output: context.input,
      toolsUsed: []
    };
  }
}
