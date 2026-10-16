import { WorkspaceInvitation } from './invitation.model';

export class InvitationService {
  create(workspaceId: string, email: string, role: WorkspaceInvitation['role']) {
    return {
      id: crypto.randomUUID(),
      workspaceId,
      email,
      role,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    } satisfies WorkspaceInvitation;
  }

  accept(invitation: WorkspaceInvitation) {
    return { ...invitation, acceptedAt: new Date() };
  }
}
