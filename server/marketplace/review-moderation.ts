export class ReviewModeration {
  check(review: {content:string}) {
    return { approved: Boolean(review.content), reason: null };
  }
}
