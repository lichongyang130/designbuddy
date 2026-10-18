export class WorkspaceManager {
  private workspaces = new Map<string,string>();
  create(id:string,name:string){ this.workspaces.set(id,name); }
  get(id:string){ return this.workspaces.get(id); }
}
