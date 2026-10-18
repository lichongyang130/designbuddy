export class WorkflowVersionManager { versions=new Map<string,any>(); save(id:string,workflow:any){this.versions.set(id,workflow);} get(id:string){return this.versions.get(id);} }
