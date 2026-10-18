export interface AgentDefinition { id:string; role:string; metadata?:Record<string,unknown> }

export class AgentRegistry {
 private agents=new Map<string,AgentDefinition>();
 register(agent:AgentDefinition){this.agents.set(agent.id,agent);}
 get(id:string){return this.agents.get(id);}
 list(){return [...this.agents.values()];}
}
