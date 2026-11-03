import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ModelCatalog } from '../src/core/models.ts'

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
