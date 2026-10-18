export class TenantIsolation {
  private tenants = new Set<string>();
  register(tenantId: string){ this.tenants.add(tenantId); }
  exists(tenantId: string){ return this.tenants.has(tenantId); }
}
