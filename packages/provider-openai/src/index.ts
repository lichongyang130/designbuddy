import type { ConfigSchema, Context, PluginMeta } from '@designbuddy/core'
import type {
  AssistantTurn,
  ChatMessage,
  ChatRequest,
  LlmChunk,
  LlmProvider,
  ModelInfo,
  ToolCall,
} from '@designbuddy/llm'

export const name = 'provider-openai'
export const inject = ['llm']

export const meta: PluginMeta = {
  title: 'OpenAI 兼容模型',
  description: '接入任何 OpenAI 兼容接口：OpenAI、DeepSeek、Moonshot、vLLM、Ollama 均可。',
  category: 'model',
  tags: ['openai', 'deepseek', 'provider'],
  order: 26,
}

export const Config: ConfigSchema = [
  {
    key: 'baseUrl',
    label: '接口地址',
    type: 'string',
    default: 'https://api.openai.com/v1',
    placeholder: 'https://api.deepseek.com/v1',
  },
  {
    key: 'apiKey',
    label: 'API Key',
    type: 'string',
    default: '',
    description: '留空则读取环境变量 OPENAI_API_KEY / DEEPSEEK_API_KEY。',
  },
  {
    key: 'models',
    label: '模型列表',
    type: 'string',
    default: 'gpt-4o-mini',
    description: '逗号分隔，例如：gpt-4o-mini,gpt-4o — 或 deepseek-chat,deepseek-reasoner。',
  },
  {
    key: 'label',
    label: '显示名称',
    type: 'string',
    default: 'OpenAI 兼容',
  },
  {
    key: 'temperature',
    label: 'temperature',
    type: 'number',
    default: 0.7,
  },
]

interface ProviderConfig {
  baseUrl?: string
  apiKey?: string
  models?: string
  label?: string
  temperature?: number
}

function createProvider(config: ProviderConfig): LlmProvider {
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || ''
  const label = config.label || 'OpenAI 兼容'
  const names = (config.models || 'gpt-4o-mini')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const models: ModelInfo[] = names.map((model) => ({
    id: `openai/${model}`,
    label: `${label} · ${model}`,
    provider: 'openai',
    contextWindow: 128_000,
    supportsTools: true,
  }))

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  }

  const body = (request: ChatRequest, stream: boolean) => ({
    model: request.model,
    messages: toOpenAiMessages(request.messages),
    tools: request.tools?.length
      ? request.tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        }))
      : undefined,
    tool_choice: request.tools?.length ? 'auto' : undefined,
    temperature: request.temperature ?? config.temperature ?? 0.7,
    max_tokens: request.maxTokens,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  })

  return {
    id: 'openai',
    label,
    models,
    async chat(request) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body(request, false)),
        signal: request.signal,
      })
      if (!response.ok) throw new Error(`model error ${response.status}: ${await response.text()}`)
      const json: any = await response.json()
      const message = json.choices?.[0]?.message ?? {}
      const calls: ToolCall[] = (message.tool_calls ?? []).map((call: any) => ({
        id: call.id,
        name: call.function?.name,
        arguments: safeJson(call.function?.arguments),
      }))
      return {
        text: message.content ?? '',
        toolCalls: calls,
        usage: json.usage
          ? {
              inputTokens: json.usage.prompt_tokens ?? 0,
              outputTokens: json.usage.completion_tokens ?? 0,
            }
          : undefined,
        finishReason: calls.length ? 'tool_calls' : 'stop',
      }
    },
    async *stream(request): AsyncIterable<LlmChunk> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body(request, true)),
        signal: request.signal,
      })
      if (!response.ok || !response.body) {
        throw new Error(`model error ${response.status}: ${await response.text()}`)
      }
      const partials = new Map<number, { id: string; name: string; args: string }>()
      let text = ''

      for await (const line of readLines(response.body)) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        let json: any
        try {
          json = JSON.parse(payload)
        } catch {
          continue
        }
        if (json.usage) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: json.usage.prompt_tokens ?? 0,
              outputTokens: json.usage.completion_tokens ?? 0,
            },
          }
        }
        const delta = json.choices?.[0]?.delta
        if (!delta) continue
        if (delta.content) {
          text += delta.content
          yield { type: 'text', text: delta.content }
        }
        for (const call of delta.tool_calls ?? []) {
          const index = call.index ?? 0
          const entry = partials.get(index) ?? { id: '', name: '', args: '' }
          if (call.id) entry.id = call.id
          if (call.function?.name) entry.name = call.function.name
          if (call.function?.arguments) entry.args += call.function.arguments
          partials.set(index, entry)
        }
      }

      for (const [index, entry] of partials) {
        yield {
          type: 'tool_call',
          call: {
            id: entry.id || `call_${index}`,
            name: entry.name,
            arguments: safeJson(entry.args),
          },
        }
      }
    },
  }
}

function toOpenAiMessages(messages: ChatMessage[]) {
  return messages.map((message) => {
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
        })),
      }
    }
    if (message.role === 'tool') {
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content }
    }
    return { role: message.role, content: message.content }
  })
}

async function* readLines(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) yield line.trim()
  }
  if (buffer.trim()) yield buffer.trim()
}

function safeJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') return (raw as Record<string, unknown>) ?? {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function apply(ctx: Context, config: ProviderConfig): void {
  const llm = ctx.get<{ register(provider: LlmProvider): LlmProvider; unregister(id: string): void }>('llm')
  if (!llm) return
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('未配置 API Key：在插件配置里填写，或设置 OPENAI_API_KEY / DEEPSEEK_API_KEY 后重启')
  }
  const provider = llm.register(createProvider(config))
  ctx.effect(() => llm.unregister(provider.id))
}
