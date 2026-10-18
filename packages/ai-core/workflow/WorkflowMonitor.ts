export class WorkflowMonitor { traces:any[]=[]; record(item:any){this.traces.push(item);} getTrace(){return this.traces;} }
