export interface AIConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export const defaultConfig: AIConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat'
};
