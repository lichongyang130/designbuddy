export class MarketplaceSearchEngine {
  search(items: any[], keyword: string) {
    if (!keyword) return items;
    return items.filter(item =>
      String(item.name || '').toLowerCase().includes(keyword.toLowerCase())
    );
  }
}
