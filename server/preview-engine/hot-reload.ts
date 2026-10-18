import type { PreviewEvent } from "./preview-types";

export type PreviewEventListener = (event: PreviewEvent) => void;

/**
 * Small process-local event hub for WebSocket/SSE adapters.
 * Authentication and session ownership must be checked before subscribing.
 */
export class HotReloadHub {
  private readonly listeners = new Map<string, Set<PreviewEventListener>>();

  subscribe(sessionId: string, listener: PreviewEventListener): () => void {
    const bucket = this.listeners.get(sessionId) ?? new Set<PreviewEventListener>();
    bucket.add(listener);
    this.listeners.set(sessionId, bucket);

    return () => {
      const current = this.listeners.get(sessionId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(sessionId);
    };
  }

  publish(event: PreviewEvent): number {
    const listeners = this.listeners.get(event.sessionId);
    if (!listeners) return 0;

    // Snapshot the listeners so unsubscribe during dispatch is safe.
    for (const listener of [...listeners]) {
      try {
        listener({ ...event, payload: event.payload ? { ...event.payload } : undefined });
      } catch {
        // One disconnected client must not prevent delivery to other clients.
      }
    }
    return listeners.size;
  }

  publishFilesUpdated(input: {
    sessionId: string;
    version: number;
    changedPaths: string[];
    timestamp?: number;
  }): number {
    const changedPaths = [...new Set(input.changedPaths)]
      .filter((path) => path.length > 0 && !path.startsWith("/") && !path.split("/").includes(".."));

    return this.publish({
      sessionId: input.sessionId,
      type: "files-updated",
      version: input.version,
      timestamp: input.timestamp ?? Date.now(),
      payload: { changedPaths }
    });
  }

  listenerCount(sessionId: string): number {
    return this.listeners.get(sessionId)?.size ?? 0;
  }

  removeSession(sessionId: string): void {
    this.listeners.delete(sessionId);
  }
}
