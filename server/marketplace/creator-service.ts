export class CreatorService {
  getStats(creatorId: string) {
    return {
      creatorId,
      downloads: 0,
      revenue: 0,
      rating: 0,
    };
  }
}
