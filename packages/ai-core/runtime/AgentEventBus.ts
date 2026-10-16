type Handler = (event: unknown) => void;

export class AgentEventBus {
  private handlers = new Set<Handler>();

  subscribe(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(event: unknown) {
    this.handlers.forEach(handler => handler(event));
  }
}
