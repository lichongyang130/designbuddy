export class PaymentService {
  calculateCreatorShare(amount:number) {
    return {
      creator: amount * 0.7,
      platform: amount * 0.3
    };
  }
}
