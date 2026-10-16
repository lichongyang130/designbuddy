export class SaaSProvisioner {
  provision(tenantId:string){
    return { tenantId, status: 'READY' };
  }
}
