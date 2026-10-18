import { WorkflowDefinition } from './WorkflowDefinition';

export class WorkflowEngine {
  async execute(definition: WorkflowDefinition) {
    return { workflowId: definition.id, status: 'RUNNING' };
  }
}
