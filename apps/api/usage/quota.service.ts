import { UsageQuota } from './quota.model';

export class QuotaService {
  check(quota: UsageQuota, tokens: number) {
    return quota.usedTokens + tokens <= quota.monthlyTokenLimit;
  }

  consume(quota: UsageQuota, tokens: number) {
    quota.usedTokens += tokens;
    return quota;
  }
}
