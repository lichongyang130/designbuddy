export class SubscriptionManager {
  private plans = new Map<string,string>();
  subscribe(tenantId:string, plan:string){ this.plans.set(tenantId, plan); }
  getPlan(tenantId:string){ return this.plans.get(tenantId); }
}
