export interface AgentContext {
  userId: string;
  projectId: string;
  input: string;
}

export class AgentRuntime {
  async run(context: AgentContext) {
    return {
      status: 'completed',
      task: context.input,
      tools: []
    };
  }
}
