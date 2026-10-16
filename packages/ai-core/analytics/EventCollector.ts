export class EventCollector {
  private events: unknown[] = [];
  collect(event: unknown) { this.events.push(event); }
  list() { return this.events; }
}
