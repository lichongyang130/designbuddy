import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createArtifact, docBlocks, outputDir } from '../src/core/artifact.ts'
import { outlineFor } from '../src/core/outline.ts'
import { unzip } from '../src/office/zip.ts'

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'db-artifact-'))
}

test('artifact: 文档产出是一个能打开的 DOCX（有 document.xml，正文里是这份大纲）', async () => {
  const dir = tempDir()
  try {
    const artifact = await createArtifact({ prompt: '帮我写一份面向新员工的产品使用手册', kind: '文档' }, dir)
    assert.equal(artifact.files.length, 1)
    const file = artifact.files[0]!
    assert.ok(file.name.endsWith('.docx'))
    assert.equal(file.inline, false)

    const buffer = readFileSync(join(dir, artifact.id, file.name))
    assert.equal(buffer.length, file.bytes)
    const parts = unzip(buffer)
    assert.ok(parts.has('[Content_Types].xml'))
    assert.ok(parts.has('word/document.xml'))
    const xml = parts.get('word/document.xml')!.toString('utf8')
    const outline = outlineFor({ prompt: '帮我写一份面向新员工的产品使用手册', kind: '文档' })
    assert.ok(xml.includes(outline.title), '文档标题应该进正文')
    for (const section of outline.sections) assert.ok(xml.includes(section.title), section.title)
    // 段落块与写进 docx 的块一一对应：标题 + 口径 + 每段一个小标题和要点 + 落款
    const points = outline.sections.reduce((sum, section) => sum + section.points.length, 0)
    assert.equal(docBlocks(outline).length, 2 + outline.sections.length + points + 1)
    // 要点不是标题的复读机：每一段的要点都要真的进正文
    for (const section of outline.sections) {
      for (const point of section.points) assert.ok(xml.includes(point.text), point.text)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('artifact: 轮播图每屏一张 SVG，外加一个装得下全部的 zip', async () => {
  const dir = tempDir()
  try {
    const artifact = await createArtifact({ prompt: '小红书九宫格，讲通勤咖啡怎么选', kind: '轮播图' }, dir)
    assert.equal(artifact.kind, 'carousel')
    const pages = artifact.files.filter((file) => file.inline)
    assert.equal(pages.length, artifact.count)
    const bundle = artifact.files.find((file) => !file.inline)!
    assert.ok(bundle.name.endsWith('.zip'))

    const first = readFileSync(join(dir, artifact.id, pages[0]!.name), 'utf8')
    assert.ok(first.startsWith('<?xml'))
    assert.ok(first.includes('viewBox="0 0 1080 1350"'), '轮播是 1080×1350')
    assert.ok(first.includes('</svg>'))

    // zip 里的东西和单独下的一模一样
    const zipped = unzip(readFileSync(join(dir, artifact.id, bundle.name)))
    assert.equal(zipped.size, pages.length)
    for (const page of pages) {
      const inner = zipped.get(page.name)!
      assert.equal(inner.toString('utf8'), readFileSync(join(dir, artifact.id, page.name), 'utf8'))
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('artifact: 图片是 1600×1200，同一句需求画出来的字节一致', async () => {
  const dir = tempDir()
  try {
    const request = { prompt: '给一款极简台灯做一组 4 张产品图', kind: '图片' }
    const one = await createArtifact(request, dir)
    const two = await createArtifact(request, dir)
    assert.equal(one.kind, 'image')
    assert.notEqual(one.id, two.id, '每次产出是新目录')
    const a = readFileSync(join(dir, one.id, one.files[0]!.name), 'utf8')
    const b = readFileSync(join(dir, two.id, two.files[0]!.name), 'utf8')
    assert.equal(a, b, '大纲一样，画出来的图也应该一样')
    assert.ok(a.includes('viewBox="0 0 1600 1200"'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('artifact: 文件名与地址都是安全的（中文保留、不带目录穿越）', async () => {
  const dir = tempDir()
  try {
    const artifact = await createArtifact({ prompt: '做一份 ../../etc/passwd 竞品分析报告', kind: '文档' }, dir)
    for (const file of artifact.files) {
      assert.ok(!file.name.includes('/'), file.name)
      assert.ok(!file.name.includes('..'), file.name)
      assert.ok(file.url.startsWith('output/'), file.url)
      assert.ok(!file.url.includes('..'), file.url)
      // 中文名要走 encodeURIComponent，不然浏览器取不到
      assert.ok(!/[\u4e00-\u9fa5]/.test(file.url), file.url)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('artifact: 产出目录可以被环境变量改掉（两个入口共用一份）', () => {
  const previous = process.env.DB_OUTPUT_DIR
  try {
    process.env.DB_OUTPUT_DIR = '/tmp/db-output-probe'
    assert.equal(outputDir('/whatever'), '/tmp/db-output-probe')
    delete process.env.DB_OUTPUT_DIR
    assert.ok(outputDir('/repo').endsWith(join('.designbuddy', 'output')))
  } finally {
    if (previous === undefined) delete process.env.DB_OUTPUT_DIR
    else process.env.DB_OUTPUT_DIR = previous
  }
})
