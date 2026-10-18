export class SecurityAudit {
  private logs:string[]=[];
  record(event:string){this.logs.push(event);}
  getLogs(){return this.logs;}
}
