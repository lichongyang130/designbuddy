export class WorkflowDebugger { logs:string[]=[]; debug(message:string){this.logs.push(message);} getLogs(){return this.logs;} }
