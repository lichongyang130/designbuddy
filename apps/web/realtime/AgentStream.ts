export interface AgentEvent {
  type: string;
  payload: unknown;
}

export class AgentStream {
  private listeners: Array<(event: AgentEvent) => void> = [];

  subscribe(listener: (event: AgentEvent) => void) {
    this.listeners.push(listener);
  }

  emit(event: AgentEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}
