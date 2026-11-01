import type { Context } from '@designbuddy/core'
import type {
  AssistantTurn,
  ChatRequest,
  LlmChunk,
  LlmProvider,
  ModelInfo,
} from './types'
import { splitModelId } from './types'

export interface RoutedModel {
  provider: LlmProvider
  model: ModelInfo
}

/**
 * The model router exposed as `ctx.get('llm')`.
 *
 * Providers are plugins: they inject `llm` and call `llm.register(...)`. When a
 * provider plugin unloads its models disappear from `llm.models()`, and any
 * plugin that injected `llm:provider:<id>` is suspended with it.
 */
export class LlmService {
  private providers = new Map<string, LlmProvider>()
  /** Bumped whenever the provider set changes; consumers can cache on it. */
  version = 0

  constructor(private readonly ctx: Context) {}

  register(provider: LlmProvider): LlmProvider {
    this.providers.set(provider.id, provider)
    for (const model of provider.models) this.ctx.set(`llm:model:${model.id}`, model)
    this.ctx.set(`llm:provider:${provider.id}`, provider)
    this.version++
    this.ctx.emit('llm/changed', this.models())
    this.ctx.log('info', `provider "${provider.id}" registered ${provider.models.length} model(s)`)
    return provider
  }

  unregister(id: string): void {
    this.providers.delete(id)
    this.version++
    this.ctx.emit('llm/changed', this.models())
  }

  listProviders(): LlmProvider[] {
    return [...this.providers.values()]
  }

  models(): ModelInfo[] {
    return [...this.providers.values()].flatMap((provider) => provider.models)
  }

  /** The model the UI should preselect. */
  defaultModel(): string {
    return this.models()[0]?.id ?? 'mock/designer'
  }

  resolve(modelId: string): RoutedModel {
    const handled = modelId || this.defaultModel()
    const { provider } = splitModelId(handled)
    const route = this.providers.get(provider)
    if (!route) throw new Error(`no provider registered for model "${handled}"`)
    const model = route.models.find((item) => item.id === handled)
    if (!model) throw new Error(`provider "${provider}" has no model "${handled}"`)
    return { provider: route, model }
  }

  async chat(request: ChatRequest): Promise<AssistantTurn> {
    const { provider, model } = this.resolve(request.model)
    const normalized: ChatRequest = { ...request, model: model.id.split('/').slice(1).join('/') }
    return provider.chat(normalized)
  }

  async *stream(request: ChatRequest): AsyncIterable<LlmChunk> {
    const { provider, model } = this.resolve(request.model)
    const normalized: ChatRequest = { ...request, model: model.id.split('/').slice(1).join('/') }
    if (provider.stream) {
      yield* provider.stream(normalized)
      return
    }
    const turn = await provider.chat(normalized)
    if (turn.text) yield { type: 'text', text: turn.text }
    for (const call of turn.toolCalls) yield { type: 'tool_call', call }
    if (turn.usage) yield { type: 'usage', usage: turn.usage }
  }
}
