export interface Policy { action: string; allowed: boolean; }
export class PolicyEngine { evaluate(policy: Policy) { return policy.allowed; } }
