export class ComplianceManager {
  private standards = new Set<string>();
  register(name:string){this.standards.add(name);}
  compliant(name:string){return this.standards.has(name);}
}
