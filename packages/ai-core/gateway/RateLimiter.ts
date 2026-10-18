export class RateLimiter {
  private count = 0;
  allow(limit: number) { return ++this.count <= limit; }
}
