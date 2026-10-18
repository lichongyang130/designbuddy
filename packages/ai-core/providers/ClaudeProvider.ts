import {
  ModelDescriptor, ModelProvider, ModelRequest, ModelResponse,
  ProviderConfig, ProviderError, normalizeUsage,
} from './ModelProvider';

interface ClaudeResponse {
  id?: string;
  model?: string;
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class ClaudeProvider implements ModelProvider {
  readonly id = 'claude' as const;
  readonly config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = {
      baseUrl: 'https://api.anthropic.com/v1',
      defaultModel: 'claude-3-7-sonnet-latest',
      timeoutMs: 60_000,
      ...config,
    };
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const model = request.model ?? this.config.defaultModel;
    if (!model) throw new ProviderError('No model configured', this.id);
    if (!this.config.apiKey) throw new ProviderError('Missing Anthropic API key', this.id);

    const system = request.messages.filter(message => message.role === 'system')
      .map(message => message.content).join('\n\n');
    const messages = request.messages.filter(message => message.role !== 'system')
      .map(message => ({ role: message.role, content: message.content }));
    if (messages.length === 0) throw new ProviderError('At least one user or assistant message is required', this.id);

    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? this.config.timeoutMs);
    const signal = request.signal
      ? AbortSignal.any([request.signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(`${this.config.baseUrl!.replace(/\/$/, '')}/messages`, {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          ...this.config.headers,
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 2048,
          temperature: request.temperature,
          system: system || undefined,
          messages,
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ProviderError(`Anthropic API returned ${response.status}: ${detail.slice(0, 500)}`,
          this.id, response.status, response.status === 429 || response.status >= 500);
      }
      const data = await response.json() as ClaudeResponse;
      const content = (data.content ?? []).filter(part => part.type === 'text')
        .map(part => part.text ?? '').join('');
      if (!content) throw new ProviderError('Provider returned an empty response', this.id);
      const usage = normalizeUsage(data.usage?.input_tokens, data.usage?.output_tokens,
        request.messages, content);
      return {
        id: data.id ?? `claude-${started}`, provider: this.id, model: data.model ?? model,
        content, usage, finishReason: data.stop_reason, latencyMs: Date.now() - started, raw: data,
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
      id: `claude:${this.config.defaultModel ?? 'claude-3-7-sonnet-latest'}`,
      provider: this.id,
      model: this.config.defaultModel ?? 'claude-3-7-sonnet-latest',
      capabilities: ['chat', 'coding', 'reasoning', 'tools', 'long-context'],
      priority: 60,
      enabled: true,
    }];
  }
}
