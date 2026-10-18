export type CreatorLevel = 'user' | 'creator' | 'expert_creator' | 'partner';

export interface CreatorProfile {
  id: string;
  displayName: string;
  avatar?: string;
  level: CreatorLevel;
  skills: number;
  plugins: number;
  templates: number;
  downloads: number;
  rating: number;
}

export const creatorLevels = {
  user: '普通用户',
  creator: '创作者',
  expert_creator: '专家创作者',
  partner: '生态合作伙伴'
};
