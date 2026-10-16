export type ProviderId = 'openai' | 'claude' | 'deepseek' | (string & {});
export type ModelCapability = 'chat' | 'reasoning' | 'coding' | 'vision' | 'tools' | 'json' | 'long-context';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimated: boolean;
}

export interface ModelResponse {
  id: string;
  provider: ProviderId;
  model: string;
  content: string;
  usage: TokenUsage;
  finishReason?: string;
  latencyMs: number;
  raw?: unknown;
}

export interface ModelDescriptor {
  id: string;
  provider: ProviderId;
  model: string;
  capabilities: ModelCapability[];
  contextWindow?: number;
  maxOutputTokens?: number;
  costPerMillionInputTokens?: number;
  costPerMillionOutputTokens?: number;
  priority?: number;
  enabled?: boolean;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface ModelProvider {
  readonly id: ProviderId;
  readonly config: ProviderConfig;
  complete(request: ModelRequest): Promise<ModelResponse>;
  listModels?(): Promise<ModelDescriptor[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderId,
    public readonly status?: number,
    public readonly retryable = false,
    public readonly causeValue?: unknown,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function estimateTokens(text: string): number {
  // Conservative, dependency-free approximation; providers' reported usage wins.
  return Math.ceil(text.length / 4);
}

export function estimateRequestTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + 4 + estimateTokens(message.content), 2);
}

export function normalizeUsage(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  messages: ChatMessage[],
  output: string,
): TokenUsage {
  const estimated = inputTokens == null || outputTokens == null;
  const input = inputTokens ?? estimateRequestTokens(messages);
  const outputCount = outputTokens ?? estimateTokens(output);
  return { inputTokens: input, outputTokens: outputCount, totalTokens: input + outputCount, estimated };
}
