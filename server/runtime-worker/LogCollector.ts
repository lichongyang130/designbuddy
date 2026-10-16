export interface RuntimeLog {
  level: string;
  message: string;
  timestamp: number;
}

export class LogCollector {
  private logs: RuntimeLog[] = [];

  push(log: RuntimeLog) {
    this.logs.push(log);
  }

  getAll() {
    return this.logs;
  }
}
