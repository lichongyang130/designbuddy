export interface PresenceState {
  userId: string;
  workspaceId: string;
  status: 'online' | 'offline';
  updatedAt: Date;
}

export class PresenceService {
  private users = new Map<string, PresenceState>();

  update(state: PresenceState) {
    this.users.set(state.userId, state);
  }

  get(userId: string) {
    return this.users.get(userId);
  }
}
