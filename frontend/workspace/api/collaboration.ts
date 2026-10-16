import { API_BASE, apiFetch } from "../../../apps/web/src/api/client";

export type CollaborationEventType = "presence" | "cursor" | "comment" | "document";
export interface CollaborationEvent {
  id: string;
  projectId: string;
  userId: string;
  type: CollaborationEventType;
  payload: unknown;
  createdAt: string;
}

export function subscribeToProject(projectId: string, onEvent: (event: CollaborationEvent | { type: "presence.snapshot"; users: CollaborationEvent[] }) => void, onError?: () => void): () => void {
  const endpoint = `${API_BASE}/projects/${encodeURIComponent(projectId)}/collaboration/events`;
  const source = new EventSource(endpoint, { withCredentials: true });
  let announced = false;
  let heartbeat = 0;
  source.onopen = () => {
    if (!announced) {
      announced = true;
      void publishProjectEvent(projectId, "presence", { online: true }).catch(() => undefined);
      heartbeat = window.setInterval(() => void publishProjectEvent(projectId, "presence", { online: true }).catch(() => undefined), 20_000);
    }
  };
  source.onmessage = (message) => {
    try { onEvent(JSON.parse(message.data)); } catch { /* Ignore malformed frames and keep the stream alive. */ }
  };
  source.onerror = () => onError?.();
  return () => {
    source.close();
    window.clearInterval(heartbeat);
    if (announced) void publishProjectEvent(projectId, "presence", { online: false }).catch(() => undefined);
  };
}

export async function publishProjectEvent(projectId: string, type: CollaborationEventType, payload: unknown): Promise<CollaborationEvent> {
  const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/collaboration`, {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ type, payload }),
  });
  const body = await response.json().catch(() => ({} as { error?: string }));
  if (!response.ok) throw new Error(body.error || `Collaboration request failed (${response.status}).`);
  return (body as { event: CollaborationEvent }).event;
}
