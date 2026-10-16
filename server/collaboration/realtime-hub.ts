export type CollaborationEventType = "presence" | "cursor" | "comment" | "document";
export interface CollaborationEvent {
  id: string;
  projectId: string;
  userId: string;
  type: CollaborationEventType;
  payload: unknown;
  createdAt: string;
}
export interface CollaborationEventStore {
  append(event: CollaborationEvent): void;
  recent(projectId: string, limit: number): CollaborationEvent[];
}

/** Single-process SSE fan-out. Deployments with multiple API workers should inject a shared broker. */
export class RealtimeCollaborationHub {
  private listeners = new Map<string, Set<{ userId?: string; listener: (event: CollaborationEvent) => void }>>();
  private presence = new Map<string, Map<string, CollaborationEvent>>();

  constructor(private readonly store?: CollaborationEventStore) {}

  subscribe(projectId: string, listener: (event: CollaborationEvent) => void, userId?: string): () => void {
    const room = this.listeners.get(projectId) ?? new Set();
    const subscriber = { userId, listener };
    room.add(subscriber);
    this.listeners.set(projectId, room);
    return () => {
      room.delete(subscriber);
      if (room.size === 0) this.listeners.delete(projectId);
    };
  }

  publish(projectId: string, userId: string, type: CollaborationEventType, payload: unknown): CollaborationEvent {
    const event: CollaborationEvent = { id: crypto.randomUUID(), projectId, userId, type, payload, createdAt: new Date().toISOString() };
    this.store?.append(event);
    if (type === "presence") {
      const room = this.presence.get(projectId) ?? new Map();
      room.set(userId, event);
      this.presence.set(projectId, room);
    }
    for (const subscriber of this.listeners.get(projectId) ?? []) if (subscriber.userId !== userId) subscriber.listener(event);
    return event;
  }

  activePresence(projectId: string): CollaborationEvent[] {
    const now = Date.now();
    const latest = new Map<string, CollaborationEvent>();
    for (const event of [...(this.store?.recent(projectId, 500) ?? []), ...(this.presence.get(projectId)?.values() ?? [])]) {
      if (event.type !== "presence") continue;
      const current = latest.get(event.userId);
      if (!current || current.createdAt < event.createdAt) latest.set(event.userId, event);
    }
    return [...latest.values()].filter((event) =>
      (event.payload as { online?: unknown })?.online !== false && now - Date.parse(event.createdAt) < 60_000
    );
  }

  recent(projectId: string, limit = 100): CollaborationEvent[] {
    return this.store?.recent(projectId, limit) ?? [];
  }
}
