export class LongRunningTaskManager {
 private tasks=new Map<string,any>();
 start(id:string,task:any){this.tasks.set(id,{status:'running',task})}
 stop(id:string){this.tasks.delete(id)}
 status(id:string){return this.tasks.get(id)}
}
