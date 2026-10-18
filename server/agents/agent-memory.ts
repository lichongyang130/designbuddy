export class AgentMemoryStore {
  private memory = new Map<string, unknown>();

  set(key:string,value:unknown){
    this.memory.set(key,value);
  }

  get(key:string){
    return this.memory.get(key);
  }
}
