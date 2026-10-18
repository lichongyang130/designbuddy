export function renderAgentEvent(event: { type: string; payload?: unknown }) {
  return {
    name: event.type,
    data: event.payload ?? null,
    timestamp: Date.now(),
  };
}
