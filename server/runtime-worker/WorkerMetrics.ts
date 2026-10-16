export interface WorkerMetric {
  workerId: string;
  cpu: number;
  memory: number;
}

export class WorkerMetrics {
  collect(metric: WorkerMetric) {
    return metric;
  }
}
