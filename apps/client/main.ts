#!/usr/bin/env node
/**
 * Client process — spawns the Host as a child process and talks frames to it.
 *
 * Run with: `node apps/client/main.ts`
 *
 * Nothing here imports the kernel, the plugins or the Agent loop. If this file
 * could not compile without `src/core/`, the split would be cosmetic.
 */

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

import { ClientStore, HostClient } from '../../src/sdk/client.ts'
import type { HostFrame, Transport } from '../../src/sdk/protocol.ts'

const hostEntry = new URL('../host/main.ts', import.meta.url)
const child = spawn(process.execPath, [hostEntry.pathname], { stdio: ['pipe', 'pipe', 'inherit'] })

const handlers = new Set<(frame: any) => void>()
createInterface({ input: child.stdout }).on('line', (line) => {
  const trimmed = line.trim()
  if (trimmed === '') return
  let frame: HostFrame
  try {
    frame = JSON.parse(trimmed) as HostFrame
  } catch {
    return
  }
  for (const handler of [...handlers]) handler(frame)
})

const transport: Transport = {
  send(frame) {
    child.stdin.write(`${JSON.stringify(frame)}\n`)
  },
  onFrame(handler) {
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  },
}

const client = new HostClient(transport)
const store = new ClientStore()

client.onFrame((frame) => {
  store.apply(frame)
  if (frame.type === 'agent-event' && frame.event.type === 'agent/tool-call') {
    process.stdout.write(`  → ${frame.event.call.name}\n`)
  }
})

const created = (await client.request('session.create', { title: '跨进程会话' })) as { id: string }
store.track(created.id, '跨进程会话')
console.log(`session: ${created.id}（在另一个进程里）`)

const result = await client.run({
  sessionId: created.id,
  presetId: 'manager',
  prompt: '首屏改版：主色偏暗、标题层级不够，帮我定方案',
})
console.log(`result: ${result.status}`)

const view = store.get(created.id)
console.log(`transcript: ${view?.transcript.length ?? 0} 条，steps=${view?.steps ?? 0}，toolCalls=${view?.toolCalls ?? 0}`)

const tools = (await client.request('tools.list')) as { name: string }[]
console.log(`tools: ${tools.map((tool) => tool.name).join(', ')}`)

child.kill('SIGINT')
