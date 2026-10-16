export class HealthMonitor {
  check(id: string) { return { id, healthy: true }; }
}
