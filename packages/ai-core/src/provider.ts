export interface AIProvider {
  name:string;

  chat(prompt:string):Promise<string>;
}

export class MockAIProvider implements AIProvider {

  name='mock';

  async chat(prompt:string){
    return `AI response: ${prompt}`;
  }
}
