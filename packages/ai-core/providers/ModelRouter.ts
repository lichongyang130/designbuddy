import {
  ModelCapability, ModelDescriptor, ModelProvider, ModelRequest, ModelResponse, ProviderId,
  ProviderError, TokenUsage,
} from './ModelProvider';

export interface RouteRequest extends ModelRequest {
  provider?: ProviderId;
  requiredCapabilities?: ModelCapability[];
  preferredModel?: string;
  maxCostPerMillionInputTokens?: number;
  allowFallback?: boolean;
}
export interface RouterStats {
  requests: number; successes: number; failures: number; inputTokens: number; outputTokens: number;
  totalTokens: number; estimatedUsageRequests: number; providerRequests: Record<string, number>;
  modelRequests: Record<string, number>; lastLatencyMs: number;
}
export interface ModelRouterOptions {
  models?: ModelDescriptor[]; defaultProvider?: ProviderId; fallbackOrder?: ProviderId[];
  onUsage?: (response: ModelResponse) => void;
}
export class ModelRouter {
  private readonly providers = new Map<ProviderId, ModelProvider>();
  private readonly models = new Map<string, ModelDescriptor>();
  private readonly fallbackOrder: ProviderId[];
  private readonly defaultProvider?: ProviderId;
  private readonly onUsage?: (response: ModelResponse) => void;
  private readonly counters = {
    requests: 0, successes: 0, failures: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0,
    estimatedUsageRequests: 0, providerRequests: {} as Record<string, number>,
    modelRequests: {} as Record<string, number>, lastLatencyMs: 0,
  };

  constructor(options: ModelRouterOptions = {}) {
    this.defaultProvider = options.defaultProvider;
    this.fallbackOrder = options.fallbackOrder ?? ['openai', 'claude', 'deepseek'];
    this.onUsage = options.onUsage;
    for (const model of options.models ?? []) this.registerModel(model);
  }
  registerProvider(provider: ModelProvider): this { this.providers.set(provider.id, provider); return this; }
  unregisterProvider(providerId: ProviderId): boolean { return this.providers.delete(providerId); }
  registerModel(model: ModelDescriptor): this { this.models.set(model.id, { enabled: true, priority: 50, ...model }); return this; }
  listModels(): ModelDescriptor[] { return Array.from(this.models.values()).filter(model => model.enabled !== false); }

  async discoverModels(): Promise<ModelDescriptor[]> {
    const results = await Promise.all(Array.from(this.providers.values()).map(async provider => {
      try { return provider.listModels ? await provider.listModels() : []; } catch { return []; }
    }));
    for (const model of results.flat()) this.registerModel(model);
    return this.listModels();
  }

  async complete(request: RouteRequest): Promise<ModelResponse> {
    this.counters.requests += 1;
    const candidates = this.selectCandidates(request);
    if (!candidates.length) {
      this.counters.failures += 1;
      throw new ProviderError('No registered model matches provider/capability constraints',
        request.provider ?? this.defaultProvider ?? 'router');
    }
    let lastError: unknown;
    for (let index = 0; index < candidates.length; index += 1) {
      const descriptor = candidates[index];
      const provider = this.providers.get(descriptor.provider);
      if (!provider) continue;
      try {
        const response = await provider.complete({ ...request, model: descriptor.model });
        const normalized = response.provider === provider.id ? response : { ...response, provider: provider.id };
        this.recordSuccess(normalized);
        try { this.onUsage?.(normalized); } catch { /* Telemetry must not break inference. */ }
        return normalized;
      } catch (error) {
        lastError = error instanceof ProviderError && error.provider !== provider.id
          ? new ProviderError(error.message, provider.id, error.status, error.retryable, error)
          : error;
        const retryable = !(lastError instanceof ProviderError) || lastError.retryable;
        if (request.allowFallback === false || !retryable || index === candidates.length - 1) break;
      }
    }
    this.counters.failures += 1;
    throw lastError instanceof Error ? lastError : new Error('All eligible model providers failed');
  }

  getStats(): RouterStats {
    return { ...this.counters, providerRequests: { ...this.counters.providerRequests }, modelRequests: { ...this.counters.modelRequests } };
  }
  resetStats(): void {
    Object.assign(this.counters, { requests: 0, successes: 0, failures: 0, inputTokens: 0, outputTokens: 0,
      totalTokens: 0, estimatedUsageRequests: 0, providerRequests: {}, modelRequests: {}, lastLatencyMs: 0 });
  }

  private selectCandidates(request: RouteRequest): ModelDescriptor[] {
    const required = new Set(request.requiredCapabilities ?? []);
    let candidates = this.listModels().filter(model =>
      this.providers.has(model.provider) &&
      Array.from(required).every(capability => model.capabilities.includes(capability)) &&
      (request.maxCostPerMillionInputTokens == null || model.costPerMillionInputTokens == null ||
        model.costPerMillionInputTokens <= request.maxCostPerMillionInputTokens));
    const rank = (provider: ProviderId) => {
      const index = this.fallbackOrder.indexOf(provider);
      return index < 0 ? this.fallbackOrder.length : index;
    };
    candidates = candidates.sort((a, b) => {
      const aPreferred = Number(Boolean(request.preferredModel && (a.model === request.preferredModel || a.id === request.preferredModel)));
      const bPreferred = Number(Boolean(request.preferredModel && (b.model === request.preferredModel || b.id === request.preferredModel)));
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;
      const preferredProvider = request.provider ?? this.defaultProvider;
      const aDefault = Number(a.provider === preferredProvider), bDefault = Number(b.provider === preferredProvider);
      return bDefault - aDefault || (b.priority ?? 50) - (a.priority ?? 50) || rank(a.provider) - rank(b.provider);
    });
    return request.allowFallback === false ? candidates.slice(0, 1) : candidates;
  }
  private recordSuccess(response: ModelResponse): void {
    const usage: TokenUsage = response.usage;
    this.counters.successes += 1;
    this.counters.inputTokens += usage.inputTokens; this.counters.outputTokens += usage.outputTokens;
    this.counters.totalTokens += usage.totalTokens;
    if (usage.estimated) this.counters.estimatedUsageRequests += 1;
    this.counters.providerRequests[response.provider] = (this.counters.providerRequests[response.provider] ?? 0) + 1;
    const key = `${response.provider}:${response.model}`;
    this.counters.modelRequests[key] = (this.counters.modelRequests[key] ?? 0) + 1;
    this.counters.lastLatencyMs = response.latencyMs;
  }
}
