import type { PreviewActor, PreviewSession, PreviewStatus } from "./preview-types";

export class PreviewSessionError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT"
  ) {
    super(message);
    this.name = "PreviewSessionError";
  }
}

/**
 * In-memory lifecycle store for local development. Replace with a persistent
 * adapter when multiple API replicas or durable preview sessions are required.
 */
export class PreviewSessionStore {
  private readonly sessions = new Map<string, PreviewSession>();

  create(session: PreviewSession): PreviewSession {
    if (this.sessions.has(session.id)) {
      throw new PreviewSessionError("Preview session already exists.", "CONFLICT");
    }
    const stored = { ...session };
    this.sessions.set(stored.id, stored);
    return { ...stored };
  }

  get(sessionId: string): PreviewSession | undefined {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : undefined;
  }

  getOwned(sessionId: string, actor: PreviewActor): PreviewSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new PreviewSessionError("Preview session was not found.", "NOT_FOUND");
    }
    if (session.ownerId !== actor.userId && !actor.roles?.includes("admin")) {
      throw new PreviewSessionError("You do not have access to this preview session.", "FORBIDDEN");
    }
    return { ...session };
  }

  listOwned(actor: PreviewActor): PreviewSession[] {
    return [...this.sessions.values()]
      .filter((session) => session.ownerId === actor.userId || actor.roles?.includes("admin"))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((session) => ({ ...session }));
  }

  update(
    sessionId: string,
    patch: Partial<Pick<PreviewSession, "status" | "version" | "previewUrl" | "updatedAt" | "lastHeartbeatAt">>
  ): PreviewSession {
    const current = this.sessions.get(sessionId);
    if (!current) {
      throw new PreviewSessionError("Preview session was not found.", "NOT_FOUND");
    }
    const next: PreviewSession = { ...current, ...patch };
    this.sessions.set(sessionId, next);
    return { ...next };
  }

  setStatus(sessionId: string, status: PreviewStatus): PreviewSession {
    return this.update(sessionId, { status, updatedAt: Date.now() });
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}
