export class Sandbox {
  async run(code:string) {
    return {
      code,
      result:null,
      status:'isolated'
    };
  }
}
