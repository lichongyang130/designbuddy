import { AgentContext } from './agent.context';

export interface AgentAuthorizationResult {
  allowed: boolean;
  reason?: string;
}

export function authorizeAgentExecution(
  context: AgentContext
): AgentAuthorizationResult {
  if (!context.userId) {
    return {
      allowed: false,
      reason: 'missing user identity'
    };
  }

  return { allowed: true };
}
