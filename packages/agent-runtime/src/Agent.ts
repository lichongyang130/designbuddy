export interface AgentConfig {
  name:string;
  model:string;
}

export class Agent {
  constructor(private config:AgentConfig){}

  async run(prompt:string){
    return {
      agent:this.config.name,
      prompt,
      result:'Design generation task created'
    };
  }
}
