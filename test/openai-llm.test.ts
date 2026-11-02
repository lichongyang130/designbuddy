import test from 'node:test'
import assert from 'node:assert/strict'

import type { LlmChunk, LlmRequest, Message } from '../src/core/llm.ts'
import { OpenAiAdapter, parseSseLine, toChatMessages, toChatTools } from '../src/plugins/openai-llm.ts'

const userMessage = (text: string): Message => ({
  id: 'm1',
  role: 'user',
  content: [{ type: 'text', text }],
  at: Date.now(),
})

function sse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line + '\n'))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

test('our messages become one chat-completions message per turn', () => {
  const messages: Message[] = [
    { id: 's', role: 'system', content: [{ type: 'text', text: '你是设计助理' }], at: 1 },
    userMessage('改一下首屏'),
    {
      id: 'a',
      role: 'assistant',
      content: [
        { type: 'text', text: '先看设计稿' },
        { type: 'tool_call', id: 'c1', name: 'figma.inspect_frame', arguments: { frame: 'home' } },
      ],
      at: 2,
    },
    { id: 't', role: 'tool', content: [{ type: 'text', text: 'token: #2a5cf0' }], toolCallId: 'c1', at: 3 },
  ]

  const out = toChatMessages(messages)
  assert.equal(out.length, 4)
  assert.equal(out[1].content, '改一下首屏')
  assert.equal(out[2].tool_calls?.[0].function.name, 'figma.inspect_frame')
  assert.equal(out[2].tool_calls?.[0].function.arguments, '{"frame":"home"}')
  assert.equal(out[3].tool_call_id, 'c1')
})

test('tools are passed as function schemas', () => {
  const tools = toChatTools([
    { name: 'memory.recall', description: '回忆历史决策', parameters: { type: 'object', properties: {} } },
  ]) as Array<{ type: string; function: { name: string } }>
  assert.equal(tools[0].type, 'function')
  assert.equal(tools[0].function.name, 'memory.recall')
})

test('SSE parsing ignores comments, blanks and [DONE]', () => {
  assert.equal(parseSseLine(': keep-alive'), null)
  assert.equal(parseSseLine(''), null)
  assert.equal(parseSseLine('data: [DONE]'), null)
  assert.equal(parseSseLine('data: {oops'), null)
  assert.deepEqual(parseSseLine('data: {"choices":[{"delta":{"content":"你"}}]}'), {
    choices: [{ delta: { content: '你' } }],
  })
})

test('the adapter streams text, assembles tool calls and reports usage', async () => {
  const calls: Array<{ url: string; body: unknown }> = []
  const fakeFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) })
    return sse([
      'data: {"choices":[{"delta":{"content":"先"}}]}',
      'data: {"choices":[{"delta":{"content":"看稿"}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"figma.inspect_frame","arguments":"{\\"fra"}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"me\\":\\"home\\"}"}}]}}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
      'data: {"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":30}}',
      'data: [DONE]',
    ])
  }

  const adapter = new OpenAiAdapter({
    id: 'openai',
    baseUrl: 'https://api.example.com/v1/',
    apiKey: 'sk-test',
    models: ['deepseek-chat'],
    fetchImpl: fakeFetch,
  })

  const request: LlmRequest = {
    kind: 'design',
    messages: [userMessage('改首屏')],
    tools: [{ name: 'figma.inspect_frame', description: '读稿', parameters: { type: 'object', properties: {} } }],
  }

  const chunks: LlmChunk[] = []
  for await (const chunk of adapter.stream(request)) chunks.push(chunk)

  const text = chunks.filter((c) => c.type === 'text-delta').map((c) => (c as { text: string }).text).join('')
  assert.equal(text, '先看稿')

  const toolCall = chunks.find((c) => c.type === 'tool-call') as { call: { name: string; arguments: Record<string, unknown>; id: string } }
  assert.equal(toolCall.call.name, 'figma.inspect_frame')
  assert.deepEqual(toolCall.call.arguments, { frame: 'home' })
  assert.equal(toolCall.call.id, 'c1')

  const usage = chunks.find((c) => c.type === 'usage') as { inputTokens: number; outputTokens: number }
  assert.deepEqual(usage, { type: 'usage', inputTokens: 120, outputTokens: 30 })

  assert.equal(calls[0].url, 'https://api.example.com/v1/chat/completions')
  const body = calls[0].body as { stream: boolean; model: string; tools: unknown[] }
  assert.equal(body.stream, true)
  assert.equal(body.model, 'deepseek-chat')
  assert.equal(body.tools.length, 1)
})

test('a non-2xx response surfaces the provider message', async () => {
  const adapter = new OpenAiAdapter({
    id: 'openai',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-test',
    fetchImpl: async () => new Response('invalid api key', { status: 401 }),
  })
  await assert.rejects(
    (async () => {
      for await (const chunk of adapter.stream({ kind: 'design', messages: [], tools: [] })) void chunk
    })(),
    /llm http 401.*invalid api key/,
  )
})
