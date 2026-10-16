export class AgentRouter {
 route(role:string, agents:{id:string;role:string}[]){return agents.find(a=>a.role===role);}
}
