import { AgentContext } from './agent.context';

export function agentGuard(context: AgentContext) {
  if (!context.userId) {
    throw new Error('Agent execution requires authenticated user');
  }

  return true;
}
