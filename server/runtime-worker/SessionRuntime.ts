export interface RuntimeSession {
  id: string;
  status: 'created' | 'running' | 'stopped';
}

export class SessionRuntime {
  private sessions = new Map<string, RuntimeSession>();

  create(id: string) {
    const session = { id, status: 'created' as const };
    this.sessions.set(id, session);
    return session;
  }

  get(id: string) {
    return this.sessions.get(id);
  }
}
