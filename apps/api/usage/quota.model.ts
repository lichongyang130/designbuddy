export interface UsageQuota {
  userId: string;
  monthlyTokenLimit: number;
  usedTokens: number;
  resetAt: Date;
}
