/**
 * Usage ledger + quota.
 *
 * The point of these tests is the arithmetic the 会员中心 shows: today vs total,
 * the per-model breakdown, and the daily gate the host uses to refuse a run.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { UsageService, estimateTokens } from '../src/core/usage.ts'
import { createUsageStore } from '../src/core/usage-store.ts'

const entry = (at: number, input: number, output: number, model = 'mock') => ({
  at,
  sessionId: 'sess-1',
  presetId: 'default',
  model,
  inputTokens: input,
  outputTokens: output,
  ms: 120,
  status: 'ok',
})

test('estimateTokens: CJK ≈ 1 token, latin ≈ 0.28', () => {
  assert.equal(estimateTokens(''), 0)
  assert.equal(estimateTokens('设计伙伴'), 4)
  assert.equal(estimateTokens('abcdefghij'), 3)
  // 「今天 5 件事」= 4 个汉字 + 空格 + 数字 + 空格
  assert.equal(estimateTokens('今天 5 件事'), 5)
})

test('summary: today vs total, per-model bucket, newest first', () => {
  const now = new Date(2026, 10, 2, 15, 0, 0).getTime()
  const dayStart = new Date(2026, 10, 2, 0, 0, 0).getTime()
  const usage = new UsageService({ now: () => now })
  usage.record(entry(dayStart - 60_000, 100, 50, 'openai'))
  usage.record(entry(dayStart + 60_000, 200, 100))
  usage.record(entry(now, 300, 0))

  const summary = usage.summary()
  assert.equal(summary.today.runs, 2)
  assert.equal(summary.today.tokens, 600)
  assert.equal(summary.total.runs, 3)
  assert.equal(summary.total.tokens, 750)
  assert.deepEqual(
    summary.models.map((row) => [row.model, row.tokens]),
    [
      ['mock', 600],
      ['openai', 150],
    ],
  )
  assert.equal(summary.recent[0].at, now)
  assert.equal(summary.quota.used, 600)
  assert.equal(summary.quota.remaining, 200_000 - 600)
  assert.equal(summary.quota.resetsAt, new Date(2026, 10, 3, 0, 0, 0).getTime())
})

test('quota closes and reopens with the local day', () => {
  let now = new Date(2026, 10, 2, 23, 30, 0).getTime()
  const usage = new UsageService({ now: () => now, dailyTokenLimit: 100 })
  usage.record(entry(now, 80, 40))
  assert.equal(usage.canRun().ok, false)
  assert.equal(usage.quota().remaining, 0)

  now = new Date(2026, 10, 3, 0, 1, 0).getTime()
  assert.equal(usage.canRun().ok, true, '跨天之后额度重新可用')
  assert.equal(usage.quota().used, 0)
})

test('entries are normalised instead of trusted', () => {
  const usage = new UsageService({ now: () => 1_000 })
  const saved = usage.record({ ...entry(0, -5, 12.7), at: 0, status: '' } as never)
  assert.equal(saved.at, 1_000)
  assert.equal(saved.inputTokens, 0)
  assert.equal(saved.outputTokens, 13)
  assert.equal(saved.status, 'ok')
})

test('store appends one line per run and skips a corrupt one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'db-usage-'))
  const file = join(dir, 'usage.jsonl')
  try {
    const store = createUsageStore(file)
    store.append(entry(1, 10, 5))
    store.append(entry(2, 20, 10))
    writeFileSync(file, readFileSync(file, 'utf8') + '{"at": 3, "broken\n', 'utf8')

    const reopened = createUsageStore(file).readAll()
    assert.equal(reopened.length, 2, '损坏的半行被丢掉，其余照常回放')
    assert.deepEqual(
      reopened.map((row) => row.at),
      [1, 2],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hydrate replays persisted runs and keeps the quota continuous', () => {
  const now = new Date(2026, 10, 2, 12, 0, 0).getTime()
  const usage = new UsageService({ now: () => now, dailyTokenLimit: 1_000 })
  usage.hydrate([entry(now - 3_600_000, 400, 200), entry(now - 60_000, 100, 100)])
  assert.equal(usage.quota().used, 800)
  assert.equal(usage.canRun().ok, true)

  usage.record(entry(now, 200, 0))
  assert.equal(usage.canRun().ok, false, '额度用完时 host 会拒绝下一次运行')
})

/* ── 端到端：host 真的记账、真的限额 ───────────────────────── */

import { boot } from './support/app.ts'
import type { UsageService } from '../src/core/usage.ts'
import { HostServer } from '../src/sdk/host.ts'
import type { HostFrame } from '../src/sdk/protocol.ts'
import type { SessionService } from '../src/core/session.ts'

/** 极简传输：把帧喂进 host，并用 rpc.result / rpc.error 结算 Promise。 */
function loopback(app: Awaited<ReturnType<typeof boot>>) {
  const frames: HostFrame[] = []
  const waiting = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  let feed: (frame: unknown) => void = () => {}

  const server = new HostServer(app.ctx, {
    send(frame) {
      frames.push(frame as HostFrame)
      const out = frame as HostFrame
      if (out.type !== 'rpc.result' && out.type !== 'rpc.error') return
      const waiter = waiting.get(out.id)
      if (!waiter) return
      waiting.delete(out.id)
      if (out.type === 'rpc.result') waiter.resolve(out.result)
      else waiter.reject(new Error(out.message))
    },
    onFrame(handler) {
      feed = handler as (frame: unknown) => void
      return () => {}
    },
  })

  const call = (id: string, method: string, params: unknown) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('rpc timeout')), 5000)
      waiting.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
      feed({ id, method, params })
    })

  return { frames, server, call }
}

test('host 记录一次运行，并在额度用完后拒绝下一次', async (t) => {
  process.env.DB_USAGE_DAILY_TOKENS = '40'
  const app = await boot()
  t.after(async () => {
    await app.dispose()
    delete process.env.DB_USAGE_DAILY_TOKENS
  })

  const usage = app.ctx.require<UsageService>('usage')
  assert.equal(usage.dailyLimit, 40)
  assert.equal(usage.summary().today.runs, 0)

  const { server, call } = loopback(app)
  const session = app.ctx.require<SessionService>('sessions').create({ title: 'usage' })

  await call('r1', 'agent.run', { sessionId: session.id, presetId: 'default', prompt: '把标题改大一点' })

  const summary = usage.summary()
  assert.equal(summary.today.runs, 1, '一次运行记一条')
  assert.ok(summary.today.tokens > 0, 'tokens 不能是 0')
  assert.ok(summary.quota.used > 0)

  // 额度只有 40 tokens，第一次就用完了：第二次必须在开跑前被拒，而不是跑完再提示
  const second = await call('r2', 'agent.run', {
    sessionId: session.id,
    presetId: 'default',
    prompt: '再来一次',
  }).then(
    () => 'resolved',
    (error: Error) => error.message,
  )

  assert.match(String(second), /额度/)
  assert.equal(usage.summary().today.runs, 1, '被拒的那次不记账')
  server.dispose()
})
