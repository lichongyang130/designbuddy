export class PlanExecutor {
 async execute(plan:any,handler:(task:any)=>Promise<any>){
  const result=[];
  for(const task of plan.tasks){ result.push(await handler(task)); }
  return result;
 }
}
