export class FeatureFlagManager {
  private flags = new Map<string,boolean>();
  set(name:string,value:boolean){ this.flags.set(name,value); }
  enabled(name:string){ return this.flags.get(name) ?? false; }
}
