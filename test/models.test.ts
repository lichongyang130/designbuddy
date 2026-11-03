import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ModelCatalog } from '../src/core/models.ts'
import { normalizeEndpoint, probeModel } from '../src/core/model-probe.ts'

/**
 * `models.json` 是设置里「模型」页唯一的后端。这组用例守的是：
 * 首次打开会落盘示例清单、增删改真的改文件、坏文件不吞掉错误。
 */

function tempFile(name = 'models.json'): string {
  const dir = mkdtempSync(join(tmpdir(), 'db-models-'))
  return join(dir, name)
}

test('首次读取会把示例清单写进 models.json', (t) => {
  const file = tempFile()
  t.after(() => rmSync(join(file, '..'), { recursive: true, force: true }))

  const catalog = new ModelCatalog({ file })
  const list = catalog.list()
  assert.ok(list.length >= 5, `示例清单应该有几条，实际 ${list.length}`)
  assert.ok(list.every((item) => item.model !== '' && item.id !== ''))

  const onDisk = JSON.parse(readFileSync(file, 'utf8')) as { models: { model: string }[] }
  assert.equal(onDisk.models.length, list.length)
  assert.ok(onDisk.models.some((item) => item.model === 'deepseek-v4.1-flash'))
})

test('新增、修改、删除都会落到文件里', (t) => {
  const file = tempFile()
  t.after(() => rmSync(join(file, '..'), { recursive: true, force: true }))
  const catalog = new ModelCatalog({ file })
  const before = catalog.list().length

  const created = catalog.save({ name: '本地模型', model: 'local/test-1', provider: '自建' })
  assert.equal(catalog.list().length, before + 1)
  let disk = JSON.parse(readFileSync(file, 'utf8')) as { models: { id: string; name: string; model: string }[] }
  assert.ok(disk.models.some((item) => item.model === 'local/test-1' && item.name === '本地模型'))

  const updated = catalog.save({ id: created.id, name: '改过的名字', model: 'local/test-2' })
  assert.equal(updated.name, '改过的名字')
  assert.equal(updated.model, 'local/test-2')
  disk = JSON.parse(readFileSync(file, 'utf8'))
  const row = disk.models.find((item) => item.id === created.id)
  assert.ok(row && row.name === '改过的名字' && row.model === 'local/test-2')

  assert.equal(catalog.remove(created.id), true)
  assert.equal(catalog.remove(created.id), false)
  assert.equal(catalog.list().length, before)
  disk = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(disk.models.some((item) => item.id === created.id), false)
})

test('重名模型会拿到不冲突的 id，空模型名直接拒绝', (t) => {
  const file = tempFile()
  t.after(() => rmSync(join(file, '..'), { recursive: true, force: true }))
  const catalog = new ModelCatalog({ file, seed: false })

  const a = catalog.save({ model: 'free/kimi-k3' })
  const b = catalog.save({ model: 'free/kimi-k3' })
  assert.notEqual(a.id, b.id)
  assert.equal(catalog.list().length, 2)
  assert.throws(() => catalog.save({ model: '   ' }), /模型名不能为空/)
})

test('坏文件把错误留在 lastError 里，而不是静默清空', (t) => {
  const file = tempFile()
  t.after(() => rmSync(join(file, '..'), { recursive: true, force: true }))
  writeFileSync(file, '{ this is not json', 'utf8')

  const catalog = new ModelCatalog({ file })
  assert.deepEqual(catalog.list(), [])
  assert.ok((catalog.lastError() ?? '').length > 0)
})

test('API Key 单独写 models.keys.json（600），models.json 里不留明文', (t) => {
  const file = tempFile()
  t.after(() => rmSync(join(file, '..'), { recursive: true, force: true }))
  const catalog = new ModelCatalog({ file, seed: false })
  const keysFile = join(file, '..', 'models.keys.json')

  const created = catalog.save({
    model: 'deepseek-chat',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: 'sk-secret-1',
    capabilities: ['tools', 'vision'],
  })
  assert.equal(readFileSync(file, 'utf8').includes('sk-secret-1'), false)
  assert.equal(JSON.parse(readFileSync(keysFile, 'utf8'))[created.id], 'sk-secret-1')
  assert.equal(statSync(keysFile).mode & 0o777, 0o600)
  assert.equal(catalog.key(created.id), 'sk-secret-1')

  const listed = catalog.list().find((item) => item.id === created.id)
  assert.deepEqual(listed?.capabilities, ['tools', 'vision'])
  assert.equal(listed?.hasKey, true)
  assert.equal(Object.hasOwn(listed ?? {}, 'apiKey'), false)

  // 编辑时留空不覆盖旧 Key，能力集跟着改。
  catalog.save({ id: created.id, model: 'deepseek-chat', capabilities: ['tools'] })
  assert.equal(catalog.key(created.id), 'sk-secret-1')
  assert.deepEqual(catalog.list()[0]?.capabilities, ['tools'])

  // clearKey 才是显式清除。
  catalog.save({ id: created.id, model: 'deepseek-chat', clearKey: true })
  assert.equal(catalog.key(created.id), undefined)

  catalog.save({ id: created.id, model: 'deepseek-chat', apiKey: 'sk-secret-2' })
  catalog.remove(created.id)
  assert.deepEqual(JSON.parse(readFileSync(keysFile, 'utf8')), {})
})

test('normalizeEndpoint 只补缺的路径，不重写用户写全的地址', () => {
  assert.equal(normalizeEndpoint('https://api.example.com'), 'https://api.example.com/v1/chat/completions')
  assert.equal(normalizeEndpoint('https://api.example.com/'), 'https://api.example.com/v1/chat/completions')
  assert.equal(normalizeEndpoint('https://api.example.com/v1'), 'https://api.example.com/v1/chat/completions')
  assert.equal(
    normalizeEndpoint('https://api.example.com/v1/chat/completions'),
    'https://api.example.com/v1/chat/completions',
  )
  assert.equal(normalizeEndpoint('not a url'), '')
})

test('「测试连接」真的发出 POST，成功/失败都照实回报', async (t) => {
  const seen: { url?: string; auth?: string; body?: string; method?: string } = {}
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      seen.url = req.url
      seen.method = req.method
      seen.auth = req.headers.authorization
      seen.body = body
      const bad = (req.url ?? '').includes('/v1/bad')
      res.writeHead(bad ? 401 : 200, { 'content-type': 'application/json' })
      res.end(bad ? '{"error":{"message":"invalid api key"}}' : '{"choices":[]}')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const port = (server.address() as { port: number }).port
  const base = `http://127.0.0.1:${port}`

  const ok = await probeModel({ baseUrl: base + '/v1', apiKey: 'sk-live', model: 'demo-1' })
  assert.equal(ok.ok, true)
  assert.equal(ok.status, 200)
  assert.equal(ok.endpoint, base + '/v1/chat/completions')
  assert.equal(seen.method, 'POST')
  assert.equal(seen.url, '/v1/chat/completions')
  assert.equal(seen.auth, 'Bearer sk-live')
  assert.equal(JSON.parse(seen.body ?? '{}').model, 'demo-1')

  const bad = await probeModel({ baseUrl: base + '/v1/bad', apiKey: 'sk-wrong' })
  assert.equal(bad.ok, false)
  assert.equal(bad.status, 401)
  assert.match(bad.message, /401/)

  const broken = await probeModel({ baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'sk-x', timeoutMs: 1500 })
  assert.equal(broken.ok, false)
  assert.match(broken.message, /网络错误|超时/)
})
