export interface ExecutionLog {
  timestamp: number;
  nodeId: string;
  message: string;
  status: string;
}

export class ExecutionContext {
  logs: ExecutionLog[] = [];
  state: Record<string, unknown> = {};

  addLog(log: ExecutionLog) {
    this.logs.push(log);
  }
}
