export type PlanType = 'free' | 'pro' | 'team';

export interface Plan {
  id: string;
  name: string;
  type: PlanType;
  monthlyPrice: number;
  tokenLimit: number;
  projectLimit: number;
}

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    type: 'free',
    monthlyPrice: 0,
    tokenLimit: 10000,
    projectLimit: 3
  },
  {
    id: 'pro',
    name: 'Pro',
    type: 'pro',
    monthlyPrice: 20,
    tokenLimit: 1000000,
    projectLimit: 50
  }
];
