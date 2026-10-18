export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
}
