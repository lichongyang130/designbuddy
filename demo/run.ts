#!/usr/bin/env node
/**
 * DesignBuddy demo — the whole architecture in one runnable file.
 *
 * Run with: `node demo/run.ts`
 *
 * It prints, in order:
 *   1. the boot tree the profile composed (compare `dsh --dump-config`);
 *   2. a full manager → expert → memory turn, streamed through Host/Client;
 *   3. the transcript the client rebuilt from durable events only;
 *   4. routing decisions, including which adapter actually answered;
 *   5. plugin uninstall, and the two failure modes that matter:
 *      refusing to unload a provider that others still need, and cascading when
 *      you mean it.
 */

import { App } from '../src/boot/app.ts'
import { defaultModules, desktopProfile } from '../src/boot/profiles.ts'
import { Logger } from '../src/kernel/index.ts'
import { ClientStore, HostClient } from '../src/sdk/client.ts'
import { HostServer } from '../src/sdk/host.ts'
import { createLoopback } from '../src/sdk/protocol.ts'
import type { HostFrame } from '../src/sdk/protocol.ts'
import type { ModelRouter } from '../src/core/router.ts'
import type { SessionService } from '../src/core/session.ts'

const line = (title: string) => console.log(`\n${'─'.repeat(4)} ${title} ${'─'.repeat(Math.max(0, 52 - title.length))}`)

const logger = new Logger(process.env.DSH_DEBUG ? 'debug' : 'warn')
const app = await App.create({ profile: desktopProfile, modules: defaultModules, logger })

line('1. 启动装配（profile → bundles → rows）')
console.log(app.describe())

const { client: clientTransport, host: hostTransport } = createLoopback()
const server = new HostServer(app.ctx, hostTransport)
const client = new HostClient(clientTransport)

// The client owns presentation only. It never touches the kernel.
const store = new ClientStore()
client.onFrame((frame: HostFrame) => {
  store.apply(frame)
  if (frame.type === 'agent-event') {
    const event = frame.event
    if (event.type === 'agent/step') process.stdout.write(`\n  step ${event.step} `)
    else if (event.type === 'agent/text') process.stdout.write(event.text)
    else if (event.type === 'agent/tool-call') process.stdout.write(`\n  → ${event.call.name}(${JSON.stringify(event.call.arguments)})`)
    else if (event.type === 'agent/tool-result') {
      process.stdout.write(`\n  ← ${event.name} ${event.isError ? '✗' : '✓'} ${event.durationMs}ms: ${event.content.split('\n')[0]!.slice(0, 70)}`)
    }
  }
})

line('2. 一轮完整对话（manager 分派专家）')
const session = (await client.request('session.create', { title: '首屏改版' })) as { id: string }
store.track(session.id, '首屏改版')
console.log(`session: ${session.id}`)

const result = await client.run({
  sessionId: session.id,
  presetId: 'manager',
  prompt: '首屏改版：主色偏暗、标题层级不够，帮我定方案',
})
process.stdout.write('\n')
console.log(`\n  result: ${result.status}`)

line('3. 客户端从「持久事件」重建的会话')
const view = store.get(session.id)
for (const entry of view?.transcript ?? []) {
  const prefix = entry.kind === 'user' ? '👤' : entry.kind === 'assistant' ? '🤖' : `🔧 ${entry.name ?? ''}`
  console.log(`  ${prefix} ${entry.text.replace(/\n/g, '\n     ').slice(0, 160)}`)
}
console.log(`  steps=${view?.steps ?? 0} toolCalls=${view?.toolCalls ?? 0} status=${view?.status ?? 'unknown'}`)

line('4. 路由与回退记录')
const router = app.ctx.require<ModelRouter>('llm')
for (const attempt of router.attempts.slice(-6)) {
  console.log(`  ${attempt.adapter}/${attempt.model} ${attempt.ok ? 'ok' : 'failed'} ${attempt.ms}ms`)
}

line('5. 会话日志（DSH 的 append-only session log）')
const sessions = app.ctx.require<SessionService>('sessions')
const events = sessions.events(session.id)
console.log(`  ${events.length} events, types: ${[...new Set(events.map((event) => event.type))].join(', ')}`)
console.log(`  子会话: ${sessions.list().length - 1} 个（专家 fork）`)
for (const child of sessions.list().filter((candidate) => candidate.id !== session.id)) {
  console.log(`    - ${child.title} (${child.messages.length} messages)`)
}

line('6. 卸载插件：先被拒绝，再级联')
try {
  await app.unmount('design.memory')
} catch (error) {
  console.log(`  拒绝: ${(error as Error).message}`)
}

const toolsBefore = (await client.request('tools.list')) as { name: string }[]
console.log(`  卸载前工具: ${toolsBefore.map((tool) => tool.name).join(', ')}`)

const removed = await app.unmount('design.figma')
console.log(`  卸载 connector-figma: ${removed.join(' → ')}`)

const toolsAfter = (await client.request('tools.list')) as { name: string }[]
console.log(`  卸载后工具: ${toolsAfter.map((tool) => tool.name).join(', ')}`)

const cascaded = await app.unmount('design.memory', { cascade: true })
console.log(`  级联卸载 design.memory: ${cascaded.join(' → ')}`)

line('7. 卸载后的启动树')
console.log(app.tree())

await app.dispose()
server.dispose()
console.log('\n完成：内核、Agent 循环、Host/Client、插件装卸全部跑通。')
