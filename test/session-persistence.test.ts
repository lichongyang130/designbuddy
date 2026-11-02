import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SessionService } from '../src/core/session.ts'
import { createSessionStore } from '../src/core/session-store.ts'

const tempDir = () => mkdtempSync(join(tmpdir(), 'db-session-test-'))

const userMessage = (id: string, text: string) => ({
  id,
  role: 'user' as const,
  content: [{ type: 'text' as const, text }],
  at: Date.now(),
})

test('a session survives a process restart: title and messages come back', () => {
  const dir = tempDir()
  const store = createSessionStore(dir)

  const first = new SessionService({ persister: store })
  const session = first.create({ title: '落地页改版' })
  first.appendMessage(session.id, userMessage('m1', '把首屏改成两栏'))

  const second = new SessionService({ persister: store })
  for (const jsonl of store.readAll()) second.loadJsonl(jsonl)

  const restored = second.list()
  assert.equal(restored.length, 1)
  assert.equal(restored[0].id, session.id)
  assert.equal(restored[0].title, '落地页改版')
  assert.equal(restored[0].messages.length, 1)
  assert.equal(restored[0].messages[0].content[0].type, 'text')
})

test('replaying a log does not write duplicate records', () => {
  const dir = tempDir()
  const store = createSessionStore(dir)

  const first = new SessionService({ persister: store })
  const session = first.create({ title: '第二次启动' })
  first.appendMessage(session.id, userMessage('m1', 'hi'))
  const before = store.readAll().join('\n').split('\n').filter(Boolean).length

  const second = new SessionService({ persister: store })
  for (const jsonl of store.readAll()) second.loadJsonl(jsonl)

  const after = store.readAll().join('\n').split('\n').filter(Boolean).length
  assert.equal(after, before)
})

test('a corrupt line is skipped instead of killing the log', () => {
  const dir = tempDir()
  const store = createSessionStore(dir)
  const service = new SessionService({ persister: store })
  const session = service.create({ title: '坏行' })
  service.appendMessage(session.id, userMessage('m1', 'ok'))

  const jsonl = store.readAll()[0]
  const result = new SessionService().loadJsonl(jsonl + '\n{not json')
  assert.equal(result.skipped, 1)
  assert.equal(result.session.messages.length, 1)
})

test('sessions without a persister behave exactly as before', () => {
  const service = new SessionService()
  const session = service.create({ title: '内存会话' })
  service.appendMessage(session.id, userMessage('m1', 'x'))
  assert.equal(service.list().length, 1)
  assert.equal(service.events(session.id).filter((event) => event.type === 'message').length, 1)
})
