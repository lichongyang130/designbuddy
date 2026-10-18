import { AIConfig } from './config';

export class DeepSeekProvider {
  constructor(private config: AIConfig) {}

  async chat(prompt: string): Promise<string> {
    return `DeepSeek response: ${prompt}`;
  }
}
