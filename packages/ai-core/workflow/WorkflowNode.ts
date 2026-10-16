export type WorkflowNodeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface WorkflowNode {
  id: string;
  skillId: string;
  name: string;
  dependencies: string[];
  status: WorkflowNodeStatus;
  input?: Record<string, unknown>;
  output?: unknown;
}
