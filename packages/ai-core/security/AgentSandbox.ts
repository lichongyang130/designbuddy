export class AgentSandbox {
  async execute<T>(task:()=>Promise<T>):Promise<T>{ return task(); }
}
