export class CoderAgent {
  async generate(spec:string) {
    return {
      role:'coder',
      code:`// generated from ${spec}`
    };
  }
}
