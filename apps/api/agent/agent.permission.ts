export type AgentPermission =
  | 'agent:execute'
  | 'agent:use-model'
  | 'agent:export';

export function canExecuteAgent(permission: AgentPermission) {
  return permission === 'agent:execute';
}
