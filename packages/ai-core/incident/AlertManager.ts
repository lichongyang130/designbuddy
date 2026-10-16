export class AlertManager {
  private alerts: unknown[] = [];
  add(alert: unknown) { this.alerts.push(alert); }
  list() { return this.alerts; }
}
