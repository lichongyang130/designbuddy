export class Compiler {
  compile(source:string) {
    return {
      source,
      status:'compiled'
    };
  }
}
