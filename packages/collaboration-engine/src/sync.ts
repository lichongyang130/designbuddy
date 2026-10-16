export interface SyncOperation {
  action: 'create' | 'update' | 'delete';
  path: string;
  content?: string;
}

export class SyncEngine {
  apply(operation: SyncOperation) {
    return {
      synced: true,
      operation
    };
  }
}
