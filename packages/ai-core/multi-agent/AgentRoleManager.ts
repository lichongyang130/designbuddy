export class AgentRoleManager {
 private roles=new Map<string,string>();
 assign(agentId:string,role:string){this.roles.set(agentId,role);}
 roleOf(agentId:string){return this.roles.get(agentId);}
}
