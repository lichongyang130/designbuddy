export class IncidentDetector {
  detect(metrics: Record<string, unknown>) {
    return { detected: false, metrics };
  }
}
