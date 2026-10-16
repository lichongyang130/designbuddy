export interface AgentTask {
  type: string;
  payload: unknown;
}

export class OrchestratorAgent {
  async dispatch(task: AgentTask) {
    return {
      assigned: task.type,
      status: 'queued'
    };
  }
}
