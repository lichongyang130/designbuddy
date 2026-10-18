export interface PlanStep { id:string; task:string; dependencies:string[] }

export class LLMPlanner {
  constructor(private model:any) {}
  async createPlan(goal:string):Promise<PlanStep[]> {
    const result = await this.model.generate({prompt:`Create execution plan: ${goal}`});
    return result.plan ?? [];
  }
}
