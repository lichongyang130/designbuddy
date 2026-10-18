export class TenantManager {
  private tenants = new Map<string, unknown>();
  register(id: string, data: unknown) { this.tenants.set(id, data); }
}
