import { WorkflowNode } from './WorkflowNode';
import { ExecutionContext } from './ExecutionContext';

export class WorkflowExecutor {
  async execute(nodes: WorkflowNode[], context: ExecutionContext) {
    for (const node of nodes) {
      node.status = 'running';
      context.addLog({
        timestamp: Date.now(),
        nodeId: node.id,
        message: `Executing ${node.name}`,
        status: 'running'
      });

      node.status = 'completed';
      context.addLog({
        timestamp: Date.now(),
        nodeId: node.id,
        message: `Completed ${node.name}`,
        status: 'completed'
      });
    }

    return context;
  }
}
