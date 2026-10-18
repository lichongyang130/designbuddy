export class BillingManager {
  private usage = new Map<string, number>();
  charge(tenantId: string, amount: number) { this.usage.set(tenantId, (this.usage.get(tenantId) ?? 0) + amount); }
  getBalance(tenantId: string) { return this.usage.get(tenantId) ?? 0; }
}
