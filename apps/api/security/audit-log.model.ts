export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
