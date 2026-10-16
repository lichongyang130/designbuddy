export interface TaskStep {
  id: string;
  action: string;
  params?: Record<string, unknown>;
}

export class TaskPlanner {
  plan(goal: string): TaskStep[] {
    return [
      {
        id: 'step-1',
        action: 'analyze_goal',
        params: { goal }
      }
    ];
  }
}
