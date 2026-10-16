export interface PaymentProvider {
  createCheckout(planId:string, userId:string):Promise<string>;
  cancelSubscription(subscriptionId:string):Promise<boolean>;
}

export class MockPaymentProvider implements PaymentProvider {
  async createCheckout(planId:string,userId:string){
    return `checkout://${planId}/${userId}`;
  }

  async cancelSubscription(){
    return true;
  }
}
