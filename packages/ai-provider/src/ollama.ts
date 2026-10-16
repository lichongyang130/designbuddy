import { AIConfig } from './config';

export class OllamaProvider {
  constructor(private config: AIConfig) {}

  async chat(prompt: string): Promise<string> {
    return `Ollama local response: ${prompt}`;
  }
}
