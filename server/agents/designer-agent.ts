export class DesignerAgent {
  async design(prompt:string) {
    return {
      role:'designer',
      result:`Design generated for ${prompt}`
    };
  }
}
