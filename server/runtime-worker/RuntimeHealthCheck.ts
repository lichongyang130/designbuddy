export interface HealthStatus {
  healthy: boolean;
  message: string;
}

export class RuntimeHealthCheck {
  check(): HealthStatus {
    return {
      healthy: true,
      message: 'runtime available'
    };
  }
}
