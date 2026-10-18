export type MarketplaceCategory = 'skill' | 'plugin' | 'template';

export interface MarketplaceQuery {
  category?: MarketplaceCategory;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface MarketplaceInstallResult {
  success: boolean;
  assetId: string;
  installedAt: string;
}

export function buildMarketplaceEndpoint(category: MarketplaceCategory) {
  return `/api/marketplace/${category}s`;
}
