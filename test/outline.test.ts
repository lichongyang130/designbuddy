import test from 'node:test'
import assert from 'node:assert/strict'

import { kindOf, outlineFor } from '../src/core/outline.ts'

test('outline: 三种产出各有自己的结构，不会被归错类', () => {
  assert.equal(kindOf('文档'), 'doc')
  assert.equal(kindOf('轮播图'), 'carousel')
  assert.equal(kindOf('图片'), 'image')
  // 界面文案换了说法也要落回同一类，别悄悄退化成文档
  assert.equal(kindOf('九宫格'), 'carousel')
  assert.equal(kindOf('海报'), 'image')
  assert.equal(kindOf('幻灯片'), 'doc')
})

test('outline: 同一句需求算出来的大纲完全一致（纯函数）', () => {
  const request = { prompt: '帮我写一份面向新员工的产品使用手册', kind: '文档' }
  assert.deepEqual(outlineFor(request), outlineFor(request))
})

test('outline: 页数写得进去、夹得住，段落编号从 1 连续', () => {
  const six = outlineFor({ prompt: '做一份 6 屏的轮播图，讲通勤咖啡', kind: '轮播图' })
  assert.equal(six.count, 6)
  assert.deepEqual(six.sections.map((section) => section.n), [1, 2, 3, 4, 5, 6])

  const many = outlineFor({ prompt: '做一份 99 张的图片', kind: '图片' })
  assert.ok(many.count <= 8, '数量要夹在上限内，实际 ' + many.count)
  assert.equal(many.sections.length, many.count)
})

test('outline: 数量多于模板时往方法段里加，不会出现第二个封面', () => {
  const outline = outlineFor({ prompt: '做一份 7 屏的轮播图', kind: '轮播图' })
  const covers = outline.sections.filter((section) => section.title.startsWith('封面'))
  assert.equal(covers.length, 1)
  assert.ok(outline.sections.some((section) => section.title.includes('（二）')), '应该有一段是二')
})

test('outline: 主题和受众是从需求里读出来的，不是写死的', () => {
  const outline = outlineFor({ prompt: '帮我写一份面向新员工的产品使用手册', kind: '文档' })
  assert.equal(outline.audience, '新员工')
  assert.ok(outline.title.includes('产品使用手册'), '主题里应该留下被写的对象，实际 ' + outline.title)
  assert.ok(!outline.title.startsWith('帮我'), '壳子词要剥掉，实际 ' + outline.title)
})

test('outline: 生成的提示词注入行覆盖每一段，带标题与要点', () => {
  const outline = outlineFor({ prompt: '做一份竞品分析报告', kind: '文档' })
  assert.equal(outline.items.length, outline.count)
  outline.items.forEach((line, index) => {
    assert.ok(line.startsWith(String(index + 1) + '. '), line)
    assert.ok(line.includes('——'), line + ' 应该带上要点')
  })
  // 左侧对话要有话说：至少三句，最后一句要指出「点生成」
  assert.ok(outline.narration.length >= 3)
  assert.ok(outline.narration[outline.narration.length - 1]!.includes('生成'))
})

test('outline: 清单把「读懂需求 / 定结构 / 排数量」三步都写出来', () => {
  const outline = outlineFor({ prompt: '做一份产品发布材料', kind: '文档' })
  assert.deepEqual(outline.steps.map((step) => step.id), ['read', 'shape', 'count'])
  for (const step of outline.steps) assert.ok(step.label.length > 0 && step.detail)
})
