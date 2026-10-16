export class WorkingMemory {private context:Record<string,unknown>={}; set(k:string,v:unknown){this.context[k]=v;} get(k:string){return this.context[k];}}
