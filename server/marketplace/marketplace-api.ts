export interface MarketplaceQuery {
  type?: 'skill' | 'plugin' | 'template';
  keyword?: string;
  category?: string;
}

export interface MarketplaceResponse<T> {
  items: T[];
  total: number;
}

export class MarketplaceAPI {
  async list(query: MarketplaceQuery): Promise<MarketplaceResponse<unknown>> {
    return { items: [], total: 0 };
  }
}
