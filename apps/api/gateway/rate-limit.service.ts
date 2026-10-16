export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export class RateLimitService {
  check(key: string, limit: number): RateLimitResult {
    return {
      allowed: true,
      remaining: limit - 1,
    };
  }
}
