export interface Rating {
  assetId: string;
  userId: string;
  score: number;
}

export class RatingService {
  submit(rating: Rating) {
    return rating;
  }
}
