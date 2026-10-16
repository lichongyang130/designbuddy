export interface RuntimeEvent {
  type: string;
  payload: unknown;
}

export class RuntimeEventBus {
  private events: RuntimeEvent[] = [];

  publish(event: RuntimeEvent) {
    this.events.push(event);
  }

  consume() {
    return this.events.shift();
  }
}
