export interface TraceEvent { id:string; agentId:string; event:string; timestamp:number; data?:unknown }
export class AgentTracer { private events:TraceEvent[]=[]; record(event:TraceEvent){this.events.push(event)} getTrace(){return this.events} }
