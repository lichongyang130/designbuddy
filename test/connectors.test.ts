/**
 * 连接器：目录、凭据、状态机、工具注册与审计。
 *
 * 这里不联网：GitHub 那条链路用一个假的 `fetchImpl` 走完整流程，
 * 包括 401 这种「探测失败就不要落盘」的分支。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CONNECTORS, findConnector, toolNamesOf } from '../src/connectors/catalog.ts'
import { ConnectorStore } from '../src/core/connectors.ts'
import { CredentialStore } from '../src/core/credentials.ts'
import { ConnectorHub } from '../src/connectors/hub.ts'
import { createAdapter } from '../src/connectors/adapters.ts'
import { ToolRegistry } from '../src/core/tools.ts'
import type { ConnectorManifest } from '../src/core/connectors.ts'
import { boot, toolCallContext } from './support/app.ts'
import { designBundle } from '../src/boot/profiles.ts'
import { connectorArgs, connectorToolFor, decide } from '../src/plugins/mock-llm.ts'

const tempDir = () => mkdtempSync(join(tmpdir(), 'db-connector-test-'))

function makeHub(options: { fetchImpl?: typeof fetch; dir?: string; now?: () => number } = {}) {
  const dir = options.dir ?? tempDir()
  const tools = new ToolRegistry()
  const hub = new ConnectorHub({
    store: new ConnectorStore({ file: join(dir, 'connectors.json') }),
    credentials: new CredentialStore({ file: join(dir, 'connectors.keys.json') }),
    tools,
    logFile: join(dir, 'connectors.log.jsonl'),
    fetchImpl: options.fetchImpl,
    now: options.now,
  })
  return { hub, tools, dir }
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('目录：40 个连接器，字段齐全，GitHub 是唯一真连的', () => {
  assert.equal(CONNECTORS.length, 40, '连接器目录应保留 40 项')
  const ids = new Set<string>()
  for (const manifest of CONNECTORS) {
    assert.ok(/^[a-z0-9-]+$/.test(manifest.id), `${manifest.name} 的 id 不合法：${manifest.id}`)
    assert.ok(!ids.has(manifest.id), `id 重复：${manifest.id}`)
    ids.add(manifest.id)
    assert.ok(manifest.name && manifest.desc && manifest.vendor, `${manifest.id} 缺少名称/描述/厂商`)
    assert.ok(manifest.tools.length > 0, `${manifest.id} 没有声明任何工具`)
    for (const tool of manifest.tools) {
      assert.ok(/^[a-z0-9_]+$/.test(tool.name), `${manifest.id}.${tool.name} 不是合法的工具名后缀`)
    }
    if (manifest.demo) assert.ok(manifest.note, `${manifest.id} 是演示条目，必须有一句解释`)
  }

  const github = findConnector('github')
  assert.ok(github, 'GitHub 必须在目录里')
  assert.equal(github.demo, undefined, 'GitHub 不是演示条目')
  assert.equal(github.kind, 'rest')
  assert.equal(github.endpoint?.baseUrl, 'https://api.github.com')
  assert.deepEqual(toolNamesOf(github!), ['github.repo_info', 'github.list_issues'])
  assert.deepEqual(toolNamesOf(github!, { allowWrite: true }), ['github.repo_info', 'github.list_issues', 'github.create_pr'])
})

test('凭据文件权限 0600，且不会写进连接状态文件', () => {
  const dir = tempDir()
  const keys = new CredentialStore({ file: join(dir, 'connectors.keys.json') })
  const store = new ConnectorStore({ file: join(dir, 'connectors.json') })

  keys.save('github', { token: 'ghp_secret_value' })
  assert.equal(keys.has('github'), true)
  assert.deepEqual(keys.get('github'), { token: 'ghp_secret_value' })

  const mode = statSync(join(dir, 'connectors.keys.json')).mode & 0o777
  assert.equal(mode, 0o600, '凭据文件必须是 0600')

  store.set('github', { state: 'connected', since: 1, account: 'octocat' })
  const stateText = readFileSync(join(dir, 'connectors.json'), 'utf8')
  assert.doesNotMatch(stateText, /ghp_secret_value/, '状态文件里不能出现凭据')

  keys.remove('github')
  assert.equal(keys.has('github'), false)
})

test('演示连接器：连上就有工具，断开后工具消失', async () => {
  const { hub, tools, dir } = makeHub()
  const before = tools.list().map((tool) => tool.name)
  assert.ok(!before.includes('tdx.quote'))

  const connected = await hub.connect('tdx')
  assert.deepEqual(connected.tools, ['tdx.quote', 'tdx.kline'])
  assert.deepEqual(tools.list().map((tool) => tool.name).sort(), ['tdx.kline', 'tdx.quote'])

  const summary = hub.summary('tdx')
  assert.equal(summary?.state, 'connected')
  assert.equal(summary?.account, '演示数据')
  assert.deepEqual(summary?.activeTools, ['tdx.quote', 'tdx.kline'])

  const outcome = await tools.execute('tdx.quote', { symbol: '600519' }, toolCallContext)
  assert.equal(outcome.isError, false)
  const payload = JSON.parse(outcome.content)
  assert.equal(payload.demo, true, '演示数据必须自带标注')
  assert.equal(payload.result.symbol, '600519')

  const log = hub.auditLog('tdx')
  assert.equal(log.length, 1)
  assert.equal(log[0].tool, 'tdx.quote')
  assert.equal(log[0].ok, true)
  assert.ok(existsSync(join(dir, 'connectors.log.jsonl')), '审计应落盘')

  hub.disconnect('tdx')
  assert.deepEqual(tools.list().map((tool) => tool.name), [])
  assert.equal(hub.summary('tdx')?.state, 'idle')
  assert.equal(hub.summary('tdx')?.hasKey, false)
})

test('写操作工具默认不注册，连接时显式允许才会出现', async () => {
  const first = makeHub()
  await first.hub.connect('feishu')
  assert.deepEqual(first.tools.list().map((tool) => tool.name), ['feishu.list_chats'])

  const second = makeHub()
  await second.hub.connect('feishu', undefined, { allowWrite: true })
  assert.deepEqual(second.tools.list().map((tool) => tool.name).sort(), ['feishu.list_chats', 'feishu.send_message'])
})

test('REST 适配器：200 解析 JSON，401 说清原因', async () => {
  const manifest = findConnector('github')!
  const ok = await createAdapter({
    manifest,
    secrets: { token: 't' },
    allowWrite: true,
    fetchImpl: async () => jsonResponse({ full_name: 'octo/hello', stars: 42 }),
  })
  assert.equal(ok.tools.length, 3)
  const tool = ok.tools.find((item) => item.name === 'github.repo_info')!
  const text = await tool.execute({ owner: 'octo', repo: 'hello' }, toolCallContext)
  assert.match(String(text), /octo\/hello/)

  const denied = await createAdapter({
    manifest,
    secrets: { token: 'bad' },
    fetchImpl: async () => jsonResponse({ message: 'Bad credentials' }, 401),
  })
  await assert.rejects(() => denied.probe(), /凭据无效或已过期/)
})

test('GitHub 全链路：探测拿到账号，工具进注册表，失败不落盘', async () => {
  const calls: string[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    calls.push(url)
    if (url.endsWith('/user')) return jsonResponse({ login: 'octocat' })
    if (url.includes('/repos/octo/hello/issues')) return jsonResponse([{ number: 1, title: '示例 issue' }])
    if (url.includes('/repos/octo/hello')) return jsonResponse({ full_name: 'octo/hello', private: false })
    return jsonResponse({ message: 'not found' }, 404)
  }
  const { hub, tools, dir } = makeHub({ fetchImpl })

  // 缺凭据要直说缺什么
  await assert.rejects(() => hub.connect('github'), /还缺：Personal Access Token/)

  const result = await hub.connect('github', { token: 'ghp_ok' })
  assert.equal(result.account, 'octocat')
  assert.ok(result.tools.includes('github.repo_info'))
  assert.ok(!result.tools.includes('github.create_pr'), '写操作没允许就不该出现')

  const keys = JSON.parse(readFileSync(join(dir, 'connectors.keys.json'), 'utf8'))
  assert.equal(keys.github.token, 'ghp_ok')

  const outcome = await tools.execute('github.list_issues', { owner: 'octo', repo: 'hello' }, toolCallContext)
  assert.equal(outcome.isError, false)
  assert.match(outcome.content, /示例 issue/)

  // 401 的第二次连接：不写状态、不写凭据
  const failing = makeHub({ fetchImpl: async () => jsonResponse({ message: 'Bad credentials' }, 401) })
  await assert.rejects(() => failing.hub.connect('github', { token: 'bad' }), /凭据无效或已过期/)
  assert.equal(failing.hub.summary('github')?.state, 'idle')
  assert.equal(failing.hub.summary('github')?.hasKey, false)
})

test('重启后自动恢复已连接器，凭据丢了转成 error', async () => {
  const dir = tempDir()
  const first = makeHub({ dir })
  await first.hub.connect('notion', undefined, { allowWrite: true })
  assert.equal(first.tools.list().length, 2)

  const second = makeHub({ dir })
  const restored = await second.hub.restore()
  assert.deepEqual(restored, ['notion'])
  assert.equal(second.hub.summary('notion')?.state, 'connected')
  assert.equal(second.tools.list().length, 2)

  // 模拟「状态里连着、但凭据文件被用户清掉了」
  new ConnectorStore({ file: join(dir, 'connectors.json') }).set('github', { state: 'connected', since: 1 })
  const third = makeHub({ dir })
  await third.hub.restore()
  assert.equal(third.hub.summary('github')?.state, 'error')
  assert.match(String(third.hub.summary('github')?.error), /凭据已丢失/)
})

test('插件挂上后 ctx.get("connectors") 可用，工具随连接出现', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const hub = app.ctx.get<ConnectorHub>('connectors')
  assert.ok(hub, 'connector-hub 应该注册 connectors 服务')
  assert.equal(hub!.catalog().length, 40)

  const tools = app.ctx.require<ToolRegistry>('tools')
  await hub!.connect('tencent-map')
  assert.ok(tools.list().some((tool) => tool.name === 'tencent-map.geocode'))
  hub!.disconnect('tencent-map')
  assert.ok(!tools.list().some((tool) => tool.name === 'tencent-map.geocode'))
})

test('适配器对未知 kind 明确报错，而不是静默给空工具', async () => {
  const manifest: ConnectorManifest = {
    id: 'demo-x',
    name: 'Demo X',
    desc: 'x',
    vendor: 'x',
    kind: 'mcp-stdio',
    auth: [],
    tools: [{ name: 'ping', desc: 'ping' }],
  }
  await assert.rejects(() => createAdapter({ manifest, secrets: {} }), /还没有对应的运行时适配器/)
})

test('连上的连接器工具对任何预设都可见，且能被用户点名调用', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())
  const hub = app.ctx.get<ConnectorHub>('connectors')!
  const tools = app.ctx.require<ToolRegistry>('tools')

  await hub.connect('tdx')
  // 预设白名单里没有 tdx.*，但用户刚点了「连接」，下一轮就得能用
  const visible = tools.schemas(['figma.inspect_frame']).map((schema) => schema.name)
  assert.ok(visible.includes('tdx.quote'), '连接器工具应绕过预设白名单')
  assert.ok(!visible.includes('memory.recall'), '白名单依然要挡住没点名的内置工具')

  const available = new Set(visible)
  assert.equal(connectorToolFor('用通达信查一下 600519 的报价', available, new Set()), 'tdx.quote')
  assert.equal(connectorToolFor('随便画个首页', available, new Set()), undefined)
  assert.deepEqual(connectorArgs('tdx.quote', '用通达信查一下 600519 的报价'), { symbol: '600519' })

  const decision = decide(
    {
      model: 'mock-design-1',
      messages: [{ role: 'user', content: [{ type: 'text', text: '用通达信查一下 600519 的报价' }] }],
      tools: [...available].map((name) => ({ name, description: name })),
    } as never,
    ['figma.inspect_frame'],
  )
  assert.equal(decision.call?.name, 'tdx.quote')
  assert.deepEqual(decision.call?.arguments, { symbol: '600519' })

  hub.disconnect('tdx')
  assert.ok(!tools.schemas(['figma.inspect_frame']).some((schema) => schema.name === 'tdx.quote'))
})

test('网络层失败给出可读原因，而不是一句 fetch failed', async () => {
  const manifest = findConnector('github')
  assert.ok(manifest)
  const offline = (async () => {
    const error = new TypeError('fetch failed')
    ;(error as { cause?: unknown }).cause = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND api.github.com' }
    throw error
  }) as unknown as typeof fetch
  const adapter = await createAdapter({ manifest: manifest!, secrets: { token: 'x' }, fetchImpl: offline })
  await assert.rejects(() => adapter.probe(), /域名解析失败.*api\.github\.com/)

  const tls = (async () => {
    const error = new TypeError('fetch failed')
    ;(error as { cause?: unknown }).cause = { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }
    throw error
  }) as unknown as typeof fetch
  const adapter2 = await createAdapter({ manifest: manifest!, secrets: { token: 'x' }, fetchImpl: tls })
  await assert.rejects(() => adapter2.probe(), /TLS 证书校验失败/)
})
