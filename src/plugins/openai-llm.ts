/**
 * OpenAI-compatible model adapter (DeepSeek / OpenAI / 任何兼容网关).
 *
 * The framework's only requirement of a vendor is `LlmAdapter.stream()`, so this
 * file is the whole integration: translate our `Message[]` into chat-completions
 * JSON, read the SSE stream back, and re-emit it as `LlmChunk`s. Tools are passed
 * as OpenAI function schemas and streamed tool-call deltas are accumulated by
 * index before being emitted, because a partial JSON fragment is useless to the
 * loop.
 *
 * 没配 `DB_LLM_API_KEY` 时这个插件不会装载，`mock-llm` 继续兜底，因此离线环境
 * 仍然可以跑完整条 Agent 循环。
 *
 * @module designbuddy/plugins/openai-llm
 */

import type { Context } from '../kernel/index.ts'
import type { LlmAdapter, LlmChunk, LlmRequest, Message, ToolCallPart, ToolSchema } from '../core/llm.ts'
import { textOf } from '../core/llm.ts'
import { ModelRouter } from '../core/router.ts'
import { nextId } from '../core/schema.ts'

export const name = 'openaiLlm'

export const inject = ['llm']

export interface Config {
  /** 例如 https://api.deepseek.com/v1（不带 /chat/completions）。 */
  baseUrl?: string
  apiKey?: string
  models?: string[]
  /** 测试里注入假 fetch，生产走全局 fetch。 */
  fetchImpl?: typeof fetch
}

export const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
export const DEFAULT_MODELS = ['deepseek-chat']

type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

interface ChatMessage {
  role: ChatRole
  content: string
  tool_call_id?: string
  name?: string
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
}

/** Our messages are multi-part; OpenAI wants one string plus tool metadata. */
export function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map((message) => {
    const text = textOf(message)
    const calls = message.content.filter((part): part is ToolCallPart => part.type === 'tool_call')
    const out: ChatMessage = { role: message.role, content: text }
    if (message.toolCallId) out.tool_call_id = message.toolCallId
    if (message.name) out.name = message.name
    if (calls.length > 0) {
      out.tool_calls = calls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
      }))
    }
    return out
  })
}

export function toChatTools(tools: ToolSchema[]): unknown[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

interface StreamEvent {
  choices?: Array<{
    delta?: {
      content?: string | null
      tool_calls?: Array<{
        index?: number
        id?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

/**
 * Parse one SSE line. Returns null for comments, blank lines and `[DONE]`.
 * Exported because this is where provider quirks bite, so it should be testable
 * without a network.
 */
export function parseSseLine(line: string): StreamEvent | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice(5).trim()
  if (payload === '' || payload === '[DONE]') return null
  try {
    return JSON.parse(payload) as StreamEvent
  } catch {
    return null
  }
}

export class OpenAiAdapter implements LlmAdapter {
  readonly id: string
  readonly models: readonly string[]
  #baseUrl: string
  #apiKey: string
  #fetch: typeof fetch

  constructor(options: { id: string; baseUrl: string; apiKey: string; models?: string[]; fetchImpl?: typeof fetch }) {
    this.id = options.id
    this.models = options.models ?? DEFAULT_MODELS
    this.#baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.#apiKey = options.apiKey
    this.#fetch = options.fetchImpl ?? globalThis.fetch
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmChunk> {
    const body: Record<string, unknown> = {
      model: request.model ?? this.models[0],
      messages: toChatMessages(request.messages),
      stream: true,
      stream_options: { include_usage: true },
    }
    if (request.tools.length > 0) body.tools = toChatTools(request.tools)
    if (typeof request.temperature === 'number') body.temperature = request.temperature
    if (typeof request.maxTokens === 'number') body.max_tokens = request.maxTokens

    const response = await this.#fetch(this.#baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
      signal: request.signal,
    })

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '')
      throw new Error(`llm http ${response.status}${detail ? ': ' + detail.slice(0, 200) : ''}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const toolCalls = new Map<number, ToolCallPart>()
    let buffer = ''
    let usage: { inputTokens: number; outputTokens: number } | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const event = parseSseLine(line)
        if (!event) continue
        const choice = event.choices?.[0]
        const delta = choice?.delta
        if (delta?.content) yield { type: 'text-delta', text: delta.content }
        for (const call of delta?.tool_calls ?? []) {
          const index = call.index ?? 0
          const current = toolCalls.get(index) ?? { type: 'tool_call', id: '', name: '', arguments: {} }
          if (call.id) current.id = call.id
          if (call.function?.name) current.name = call.function.name
          if (call.function?.arguments) {
            current.arguments = { __raw: String((current.arguments as { __raw?: string }).__raw ?? '') + call.function.arguments }
          }
          toolCalls.set(index, current)
        }
        if (event.usage) {
          usage = {
            inputTokens: event.usage.prompt_tokens ?? 0,
            outputTokens: event.usage.completion_tokens ?? 0,
          }
        }
      }
    }

    for (const call of toolCalls.values()) {
      const raw = String((call.arguments as { __raw?: string }).__raw ?? '').trim()
      yield {
        type: 'tool-call',
        call: {
          type: 'tool_call',
          id: call.id || nextId('call'),
          name: call.name,
          arguments: raw === '' ? {} : safeParse(raw),
        },
      }
    }

    if (usage) yield { type: 'usage', ...usage }
  }
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function apply(ctx: Context, config: Config = {}): void {
  const apiKey = config.apiKey ?? process.env.DB_LLM_API_KEY
  const baseUrl = config.baseUrl ?? process.env.DB_LLM_BASE_URL ?? DEFAULT_BASE_URL
  if (!apiKey) return

  const models = config.models ?? (process.env.DB_LLM_MODEL ? [process.env.DB_LLM_MODEL] : DEFAULT_MODELS)
  const router = ctx.require<ModelRouter>('llm')
  const adapter = new OpenAiAdapter({ id: 'openai', baseUrl, apiKey, models, fetchImpl: config.fetchImpl })

  ctx.effect(() => router.register(adapter))
  ctx.effect(() => router.setPolicy('planning', ['openai']))
  ctx.effect(() => router.setPolicy('design', ['openai']))
  ctx.effect(() => router.setPolicy('copy', ['openai']))
  ctx.effect(() => router.setPolicy('review', ['openai']))
}
