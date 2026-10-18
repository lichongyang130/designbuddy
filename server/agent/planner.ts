export interface TaskPlan {
  steps: string[];
}

export class AgentPlanner {
  createPlan(input: string): TaskPlan {
    return {
      steps: [
        'Analyze request',
        'Select tools',
        'Execute action'
      ]
    };
  }
}
