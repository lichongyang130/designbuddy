export interface AgentContext {
  userId: string;
  projectId?: string;
  modelProvider?: string;
  requestId?: string;
}

export function createAgentContext(userId: string): AgentContext {
  return { userId };
}
