export interface WorkflowNode { id: string; type: string; config?: Record<string, unknown>; }
export interface WorkflowEdge { from: string; to: string; }
export interface WorkflowDefinition { id: string; version: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; }
