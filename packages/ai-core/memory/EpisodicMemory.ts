export interface MemoryEvent {id:string; content:string; timestamp:number;}
export class EpisodicMemory {private events:MemoryEvent[]=[]; add(event:MemoryEvent){this.events.push(event);} list(){return this.events;}}
