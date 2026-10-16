import { SecurityEvent } from './security.event';

export class SecurityMonitor {
  events: SecurityEvent[] = [];

  track(event: SecurityEvent) {
    this.events.push(event);
  }

  getEvents() {
    return this.events;
  }
}
