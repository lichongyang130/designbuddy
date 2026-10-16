export interface WorkerTask {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
}

export class WorkerManager {
  private workers = new Map<string, WorkerTask>();

  create(task: WorkerTask) {
    this.workers.set(task.id, task);
    return task;
  }

  get(id: string) {
    return this.workers.get(id);
  }
}
