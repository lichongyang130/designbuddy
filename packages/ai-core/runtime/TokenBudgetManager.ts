export class TokenBudgetManager {
  constructor(private limit: number) {}

  private used = 0;

  consume(tokens: number) {
    if (this.used + tokens > this.limit) {
      throw new Error('Token budget exceeded');
    }
    this.used += tokens;
  }

  remaining() {
    return this.limit - this.used;
  }
}
