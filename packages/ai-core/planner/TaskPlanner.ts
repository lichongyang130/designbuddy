export interface TaskGoal { id:string; description:string }
export interface TaskPlan { tasks: TaskGoal[] }

export class TaskPlanner {
  createPlan(goal:string):TaskPlan {
    return { tasks:[{id:'root',description:goal}] };
  }
}
