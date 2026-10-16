export class AgentSupervisor {
 private agents=new Map<string,any>();
 register(id:string,agent:any){this.agents.set(id,agent);}
 get(id:string){return this.agents.get(id);}
}
