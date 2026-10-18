import type { PreviewHealth } from "./preview-types";

export interface RuntimeMonitorSnapshot {
  sessionId: string;
  health: PreviewHealth;
  consecutiveFailures: number;
  degraded: boolean;
}

export interface RuntimeMonitorOptions {
  failureThreshold?: number;
  maxCpuPercent?: number;
  maxMemoryBytes?: number;
}

export class RuntimeMonitor {
  private readonly snapshots = new Map<string, RuntimeMonitorSnapshot>();
  private readonly failureThreshold: number;
  private readonly maxCpuPercent: number;
  private readonly maxMemoryBytes: number;

  constructor(options: RuntimeMonitorOptions = {}) {
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 3);
    this.maxCpuPercent = options.maxCpuPercent ?? 95;
    this.maxMemoryBytes = options.maxMemoryBytes ?? 1024 * 1024 * 1024;
  }

  record(sessionId: string, health: PreviewHealth): RuntimeMonitorSnapshot {
    const prior = this.snapshots.get(sessionId);
    const consecutiveFailures = health.healthy ? 0 : (prior?.consecutiveFailures ?? 0) + 1;
    const resourcePressure =
      (typeof health.cpuPercent === "number" && health.cpuPercent >= this.maxCpuPercent) ||
      (typeof health.memoryBytes === "number" && health.memoryBytes >= this.maxMemoryBytes);

    const snapshot: RuntimeMonitorSnapshot = {
      sessionId,
      health: { ...health },
      consecutiveFailures,
      degraded: consecutiveFailures >= this.failureThreshold || resourcePressure
    };
    this.snapshots.set(sessionId, snapshot);
    return this.copy(snapshot);
  }

  get(sessionId: string): RuntimeMonitorSnapshot | undefined {
    const snapshot = this.snapshots.get(sessionId);
    return snapshot ? this.copy(snapshot) : undefined;
  }

  forget(sessionId: string): void {
    this.snapshots.delete(sessionId);
  }

  private copy(snapshot: RuntimeMonitorSnapshot): RuntimeMonitorSnapshot {
    return { ...snapshot, health: { ...snapshot.health } };
  }
}
