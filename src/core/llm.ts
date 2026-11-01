/**
 * LLM vocabulary and the adapter seam.
 *
 * Mirrors DSH's `llm/llm` package: messages and stream chunks are vocabulary the
 * whole system shares, while every provider is just an adapter registered under
 * `ctx.llm`. Nothing downstream knows which vendor answered.
 *
 * @module designbuddy/core/llm
 */

import type { JsonSchema } from './schema.ts'
import { nextId } from './schema.ts'

export interface TextPart {
  type: 'text'
  text: string
}

export interface ToolCallPart {
  type: 'tool_call'
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type ContentPart = TextPart | ToolCallPart

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  id: string
  role: MessageRole
  content: ContentPart[]
  /** Set on `role: 'tool'` messages so the model can match result to call. */
  toolCallId?: string
  name?: string
  at: number
}

export interface ToolSchema {
  name: string
  description: string
  parameters: JsonSchema
}

/** Routing kind, resolved to an ordered adapter chain by the model router. */
export type RouteKind = 'planning' | 'design' | 'copy' | 'review' | string

export interface LlmRequest {
  kind: RouteKind
  model?: string
  messages: Message[]
  tools: ToolSchema[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export type LlmChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; call: ToolCallPart }
  | { type: 'usage'; inputTokens: number; outputTokens: number }

/** The only interface a model vendor has to satisfy. */
export interface LlmAdapter {
  readonly id: string
  readonly models: readonly string[]
  stream(request: LlmRequest): AsyncIterable<LlmChunk>
}

/** Text of a message, joining every text part. */
export function textOf(message: Message): string {
  return message.content
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

/** Tool calls of a message. */
export function toolCallsOf(message: Message): ToolCallPart[] {
  return message.content.filter((part): part is ToolCallPart => part.type === 'tool_call')
}

export function textMessage(role: MessageRole, text: string): Message {
  return { id: nextId('msg'), role, content: [{ type: 'text', text }], at: Date.now() }
}

export function assistantMessage(text: string, calls: ToolCallPart[] = []): Message {
  const content: ContentPart[] = []
  if (text.length > 0) content.push({ type: 'text', text })
  content.push(...calls)
  return { id: nextId('msg'), role: 'assistant', content, at: Date.now() }
}

export function toolResultMessage(callId: string, name: string, content: string): Message {
  return {
    id: nextId('msg'),
    role: 'tool',
    content: [{ type: 'text', text: content }],
    toolCallId: callId,
    name,
    at: Date.now(),
  }
}

export interface CollectedStream {
  text: string
  calls: ToolCallPart[]
  usage: { inputTokens: number; outputTokens: number } | null
}

/**
 * Drain a chunk stream into one assistant message. The agent loop consumes
 * chunks as they arrive (so a Host can stream to a client); this helper exists
 * for sub-agents and tests that only care about the final message.
 */
export async function collectStream(stream: AsyncIterable<LlmChunk>): Promise<CollectedStream> {
  let text = ''
  const calls: ToolCallPart[] = []
  let usage: CollectedStream['usage'] = null
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') text += chunk.text
    else if (chunk.type === 'tool-call') calls.push(chunk.call)
    else usage = { inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens }
  }
  return { text, calls, usage }
}
