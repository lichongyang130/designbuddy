export class IncidentTimeline {
  private events: unknown[] = [];
  record(event: unknown) { this.events.push(event); }
  getEvents() { return this.events; }
}
