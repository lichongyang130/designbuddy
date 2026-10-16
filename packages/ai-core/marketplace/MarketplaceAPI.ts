export class MarketplaceAPI {
  constructor(private marketplace: unknown) {}

  listPlugins() {
    return this.marketplace;
  }

  publishSkill(skill: unknown) {
    return { success: true, skill };
  }
}
