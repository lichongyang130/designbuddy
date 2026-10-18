export class DependencyGraph {
  private edges:Map<string,string[]> = new Map();
  add(id:string,deps:string[]){this.edges.set(id,deps);}
  getDependencies(id:string){return this.edges.get(id)||[];}
}
