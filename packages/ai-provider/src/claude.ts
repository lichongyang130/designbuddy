import { AIConfig } from './config';

export class ClaudeProvider {
  constructor(private config: AIConfig) {}

  async chat(prompt: string): Promise<string> {
    return `Claude response: ${prompt}`;
  }
}
