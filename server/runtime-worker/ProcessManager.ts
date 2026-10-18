export interface ProcessInfo {
  id: string;
  status: 'started' | 'stopped';
}

export class ProcessManager {
  private processes = new Map<string, ProcessInfo>();

  start(id: string) {
    const process = { id, status: 'started' as const };
    this.processes.set(id, process);
    return process;
  }

  stop(id: string) {
    this.processes.delete(id);
  }
}
