export class UsageAnalytics {
  private metrics: Record<string, number> = {};
  record(name: string, value = 1) { this.metrics[name] = (this.metrics[name] ?? 0) + value; }
  report() { return this.metrics; }
}
