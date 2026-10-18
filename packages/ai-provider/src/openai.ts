import { AIConfig } from './config';

export class OpenAIProvider {
  constructor(private config: AIConfig) {}

  async chat(prompt: string): Promise<string> {
    return `OpenAI response: ${prompt}`;
  }
}
