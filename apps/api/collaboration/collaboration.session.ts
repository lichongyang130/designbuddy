export interface CollaborationSession {
  id: string;
  workspaceId: string;
  userId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

export function createCollaborationSession(input: CollaborationSession) {
  return input;
}
