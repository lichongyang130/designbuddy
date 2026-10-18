export class WorkflowPersistence {
 private store=new Map<string,any>();
 save(id:string,data:any){this.store.set(id,data)}
 load(id:string){return this.store.get(id)}
}
