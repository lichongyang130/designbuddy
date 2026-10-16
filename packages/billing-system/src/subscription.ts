export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'expired';
  startedAt: Date;
  expiresAt?: Date;
}

export function createSubscription(userId:string, planId:string):Subscription {
  return {
    id: crypto.randomUUID(),
    userId,
    planId,
    status:'active',
    startedAt:new Date()
  };
}
