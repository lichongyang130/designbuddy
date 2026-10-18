import { OpenAIProvider } from './OpenAIProvider';
import {
  ModelDescriptor, ModelProvider, ModelRequest, ModelResponse, ProviderConfig, ProviderId,
} from './ModelProvider';

/** DeepSeek chat-completions adapter, reusing the OpenAI-compatible transport. */
export class DeepSeekProvider implements ModelProvider {
  readonly id: ProviderId = 'deepseek';
  readonly config: ProviderConfig;
  private readonly transport: OpenAIProvider;

  constructor(config: ProviderConfig = {}) {
    this.config = {
      baseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      ...config,
    };
    this.transport = new OpenAIProvider(this.config);
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const response = await this.transport.complete(request);
    return { ...response, provider: this.id };
  }

  async listModels(): Promise<ModelDescriptor[]> {
    const model = this.config.defaultModel ?? 'deepseek-chat';
    return [
      { id: `deepseek:${model}`, provider: this.id, model,
        capabilities: ['chat', 'coding', 'json'], priority: 55, enabled: true },
      { id: 'deepseek:deepseek-reasoner', provider: this.id, model: 'deepseek-reasoner',
        capabilities: ['chat', 'reasoning', 'coding'], priority: 65, enabled: true },
    ];
  }
}
