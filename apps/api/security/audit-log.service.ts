import type { AuditLog } from './audit-log.model';

export class AuditLogService {
  private logs: AuditLog[] = [];

  record(log: AuditLog) {
    this.logs.push(log);
    return log;
  }

  list(userId: string) {
    return this.logs.filter((item) => item.userId === userId);
  }
}
