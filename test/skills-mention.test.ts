import test from 'node:test'
import assert from 'node:assert/strict'

import type { AgentEvent, AgentLoop } from '../src/core/agent.ts'
import type { SessionService } from '../src/core/session.ts'
import { mentionedTools } from '../src/core/agent-loop.ts'
import { decide } from '../src/plugins/mock-llm.ts'
import type { LlmRequest } from '../src/core/llm.ts'
import { designBundle } from '../src/boot/profiles.ts'
import { boot } from './support/app.ts'

/**
 * 「技能」页点卡片只会往输入框里写 `@工具名`。这些用例守住那条链路：
 * 点名要解析出来、要进系统提示、mock 适配器要真的先调它。
 */

test('@ 点名只认已装载的工具', () => {
  const available = ['office.read_pdf', 'memory.recall', 'expert.consult']
  assert.deepEqual(mentionedTools('@office.read_pdf /tmp/a.pdf 看看', available), ['office.read_pdf'])
  assert.deepEqual(mentionedTools('@nope.fake 你好', available), [])
  assert.deepEqual(mentionedTools('没有点名', available), [])
  assert.deepEqual(
    mentionedTools('@memory.recall @expert.consult 都在', available),
    ['memory.recall', 'expert.consult'],
  )
})

test('mock 适配器把点名的工具排在预设计划前面', () => {
  const request: LlmRequest = {
    kind: 'design',
    model: 'mock-design-1',
    messages: [{ role: 'user', content: [{ type: 'text', text: '@office.read_xlsx /tmp/t.xlsx 这表里有什么' }] }],
    tools: [
      { name: 'figma.inspect_frame', description: '', parameters: { type: 'object', properties: {} } },
      { name: 'office.read_xlsx', description: '', parameters: { type: 'object', properties: {} } },
    ],
  } as unknown as LlmRequest

  const first = decide(request, ['figma.inspect_frame'])
  assert.equal(first.call?.name, 'office.read_xlsx')
  assert.equal((first.call?.arguments as Record<string, unknown>).filePath, '/tmp/t.xlsx')
})

test('@ 点名会进入系统提示，并由 agent loop 真正执行', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const sessions = app.ctx.require<SessionService>('sessions')
  const loop = app.ctx.require<AgentLoop>('agentLoop')
  const session = sessions.create({ title: 'mention' })

  const events: AgentEvent[] = []
  for await (const event of loop.run({
    sessionId: session.id,
    presetId: 'manager',
    prompt: '@memory.recall 之前定过的主色是什么',
  })) events.push(event)

  const first = events.find((event) => event.type === 'agent/tool-call')
  assert.equal(first?.type === 'agent/tool-call' && first.call.name, 'memory.recall')

  // 点名一个没装载的工具不应该把这一轮搞崩，只是没人接这个茬。
  const other = sessions.create({ title: 'unknown mention' })
  const second: AgentEvent[] = []
  for await (const event of loop.run({
    sessionId: other.id,
    presetId: 'manager',
    prompt: '@not.a.tool 你好',
  })) second.push(event)
  assert.equal(second.at(-1)?.type, 'agent/end')
})
