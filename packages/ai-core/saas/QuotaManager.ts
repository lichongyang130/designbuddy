export class QuotaManager {
  private quotas = new Map<string,number>();
  set(tenantId:string,value:number){ this.quotas.set(tenantId,value); }
  get(tenantId:string){ return this.quotas.get(tenantId) ?? 0; }
}
