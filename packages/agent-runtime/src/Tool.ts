export interface Tool {
  name:string;
  execute(input:string):Promise<string>;
}

export class DesignTool implements Tool {
  name='design-generator';

  async execute(input:string){
    return `Generate design: ${input}`;
  }
}
