export interface UserSession {
  id: string;
  userId: string;
  device?: string;
  createdAt: Date;
  lastActiveAt: Date;
  revoked: boolean;
}

export class SessionService {
  private sessions = new Map<string, UserSession>();

  create(userId: string, device?: string) {
    const session: UserSession = {
      id: crypto.randomUUID(),
      userId,
      device,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      revoked: false,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  revoke(sessionId: string) {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.revoked = true;
    }
  }

  listByUser(userId: string) {
    return [...this.sessions.values()].filter(
      (session) => session.userId === userId
    );
  }
}
