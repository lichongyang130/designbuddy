export interface CollaborationDocument {
  id: string;
  workspaceId: string;
  version: number;
  content: unknown;
}

export function createDocument(input: CollaborationDocument) {
  return input;
}
