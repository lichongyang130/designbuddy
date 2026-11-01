/** Model-facing vocabulary shared by every provider. */

export interface ToolSchema {
  name: string
  description: string
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export interface ChatMessage {
  role: ChatRole
  content: string
  /** Tool calls requested by the assistant. */
  toolCalls?: ToolCall[]
  /** For role === 'tool'. */
  toolCallId?: string
  name?: string
}

export interface Usage {
  inputTokens: number
  outputTokens: number
}

export interface ModelInfo {
  /** Provider-namespaced id, e.g. `mock/designer` or `openai/gpt-4o-mini`. */
  id: string
  label: string
  provider: string
  contextWindow: number
  supportsTools: boolean
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  tools?: ToolSchema[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface AssistantTurn {
  text: string
  toolCalls: ToolCall[]
  usage?: Usage
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error'
}

export type LlmChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'usage'; usage: Usage }

export interface LlmProvider {
  id: string
  label: string
  models: ModelInfo[]
  chat(request: ChatRequest): Promise<AssistantTurn>
  stream?(request: ChatRequest): AsyncIterable<LlmChunk>
}

export function modelId(provider: string, model: string): string {
  return `${provider}/${model}`
}

export function splitModelId(id: string): { provider: string; model: string } {
  const index = id.indexOf('/')
  if (index < 0) return { provider: 'mock', model: id }
  return { provider: id.slice(0, index), model: id.slice(index + 1) }
}
