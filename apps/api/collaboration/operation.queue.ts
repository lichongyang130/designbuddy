export interface Operation {
  id: string;
  documentId: string;
  type: string;
  payload: unknown;
}

export class OperationQueue {
  private queue: Operation[] = [];

  push(operation: Operation) {
    this.queue.push(operation);
  }

  drain() {
    return this.queue.splice(0);
  }
}
