export class ReviewerAgent {
  async review(result:unknown) {
    return {
      role:'reviewer',
      approved:true,
      result
    };
  }
}
