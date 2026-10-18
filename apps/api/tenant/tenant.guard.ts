export class TenantGuard {
  canAccess(organizationId: string, userId: string) {
    return Boolean(organizationId && userId);
  }
}
