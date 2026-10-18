import {
  ChatMessage, ModelDescriptor, ModelProvider, ModelRequest, ModelResponse,
  ProviderConfig, ProviderError, normalizeUsage,
} from './ModelProvider';

interface OpenAIChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export class OpenAIProvider implements ModelProvider {
  readonly id = 'openai' as const;
  readonly config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4.1-mini',
      timeoutMs: 60_000,
      ...config,
    };
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const model = request.model ?? this.config.defaultModel;
    if (!model) throw new ProviderError('No model configured', this.id);
    if (!this.config.apiKey) throw new ProviderError('Missing OpenAI API key', this.id);

    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? this.config.timeoutMs);
    const signal = request.signal
      ? AbortSignal.any([request.signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(`${this.config.baseUrl!.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
          ...this.config.headers,
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ProviderError(`OpenAI-compatible API returned ${response.status}: ${detail.slice(0, 500)}`,
          this.id, response.status, response.status === 429 || response.status >= 500);
      }
      const data = await response.json() as OpenAIChatResponse;
      const choice = data.choices?.[0];
      const content = typeof choice?.message?.content === 'string'
        ? choice.message.content
        : (choice?.message?.content ?? []).map(part => part.text ?? '').join('');
      if (content == null || content === '') {
        throw new ProviderError('Provider returned an empty response', this.id);
      }
      const usage = normalizeUsage(data.usage?.prompt_tokens, data.usage?.completion_tokens,
        request.messages, content);
      return {
        id: data.id ?? `${this.id}-${started}`, provider: this.id, model: data.model ?? model,
        content, usage, finishReason: choice?.finish_reason, latencyMs: Date.now() - started, raw: data,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(error instanceof Error ? error.message : 'Unknown provider error',
        this.id, undefined, true, error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return [{
      id: `openai:${this.config.defaultModel ?? 'gpt-4.1-mini'}`,
      provider: this.id,
      model: this.config.defaultModel ?? 'gpt-4.1-mini',
      capabilities: ['chat', 'coding', 'reasoning', 'tools', 'json'],
      priority: 50,
      enabled: true,
    }];
  }
}
