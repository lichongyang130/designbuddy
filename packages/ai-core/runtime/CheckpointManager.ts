export interface AgentCheckpoint {
  taskId: string;
  iteration: number;
  state: unknown;
}

export class CheckpointManager {
  private store = new Map<string, AgentCheckpoint>();

  save(checkpoint: AgentCheckpoint) {
    this.store.set(checkpoint.taskId, checkpoint);
  }

  restore(taskId: string) {
    return this.store.get(taskId);
  }
}
