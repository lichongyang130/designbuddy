import type { Operation } from './operation.queue';

export interface SyncResult {
  applied: boolean;
  duplicate: boolean;
  operation: Operation;
  documentVersion: number;
}

export class SyncEngine {
  private readonly seenOperationIds = new Set<string>();
  private readonly documentVersions = new Map<string, number>();
  private readonly operationsByDocument = new Map<string, Operation[]>();

  apply(operation: Operation): SyncResult {
    if (!operation || !operation.id?.trim() || !operation.documentId?.trim() || !operation.type?.trim()) {
      throw new Error('Operation id, documentId, and type are required');
    }

    const currentVersion = this.documentVersions.get(operation.documentId) ?? 0;
    if (this.seenOperationIds.has(operation.id)) {
      return { applied: false, duplicate: true, operation, documentVersion: currentVersion };
    }

    this.seenOperationIds.add(operation.id);
    const nextVersion = currentVersion + 1;
    this.documentVersions.set(operation.documentId, nextVersion);
    const documentOperations = this.operationsByDocument.get(operation.documentId) ?? [];
    documentOperations.push(operation);
    this.operationsByDocument.set(operation.documentId, documentOperations);

    return { applied: true, duplicate: false, operation, documentVersion: nextVersion };
  }

  getVersion(documentId: string): number {
    return this.documentVersions.get(documentId) ?? 0;
  }

  getOperations(documentId: string): readonly Operation[] {
    return [...(this.operationsByDocument.get(documentId) ?? [])];
  }
}
