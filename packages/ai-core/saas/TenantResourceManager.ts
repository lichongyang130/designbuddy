export class TenantResourceManager {
  private resources = new Map<string, unknown>();
  allocate(tenantId:string, resource:unknown){ this.resources.set(tenantId, resource); }
  get(tenantId:string){ return this.resources.get(tenantId); }
}
