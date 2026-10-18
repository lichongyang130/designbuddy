export type MarketplaceAssetType = 'skill' | 'plugin' | 'template';

export interface MarketplaceAsset {
  id: string;
  name: string;
  description: string;
  type: MarketplaceAssetType;
  category: string;
  creatorId: string;
  downloads: number;
  rating: number;
  version: string;
  tags: string[];
}

export interface SkillDefinition extends MarketplaceAsset {
  type: 'skill';
  prompt: string;
  workflow: string[];
  requiredPlugins: string[];
}

export interface PluginDefinition extends MarketplaceAsset {
  type: 'plugin';
  manifest: Record<string, unknown>;
  permissions: string[];
}

export interface TemplateDefinition extends MarketplaceAsset {
  type: 'template';
  preview: string;
  linkedSkills: string[];
  linkedPlugins: string[];
}
