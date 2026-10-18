export interface SecurityCheckResult {
  passed: boolean;
  reason?: string;
}

export class ApiSecurityGuard {
  check(): SecurityCheckResult {
    return { passed: true };
  }
}
