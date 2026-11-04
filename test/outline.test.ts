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

test('outline: 数量多于模板时补「还没讲到」的段落，不会出现第二个封面', () => {
  const outline = outlineFor({ prompt: '做一份 7 屏的轮播图', kind: '轮播图' })
  const covers = outline.sections.filter((section) => section.title.startsWith('封面'))
  assert.equal(covers.length, 1)
  const titles = outline.sections.map((section) => section.title)
  assert.equal(new Set(titles).size, titles.length, '每一屏标题都不一样，实际 ' + titles.join(' / '))
  assert.equal(outline.sections[0]!.title.startsWith('封面'), true, '第一屏还是封面')
  assert.ok(titles.some((title) => title.startsWith('对比')), '缺了「还没讲到」的段落')
})

test('outline: 模板加补充段落都不够用时，才退回（二）轮次', () => {
  const outline = outlineFor({ prompt: '做一份 12 屏的轮播图', kind: '轮播图' })
  assert.equal(outline.count, 12)
  assert.equal(outline.sections.length, 12)
  const titles = outline.sections.map((section) => section.title)
  assert.ok(titles.some((title) => title.includes('（二）')), '12 屏超过模板+补充段落，应该有轮次，实际 ' + titles.join(' / '))
  assert.equal(outline.sections.filter((section) => section.title.startsWith('封面')).length, 1)
})

test('outline: 主题和受众是从需求里读出来的，不是写死的', () => {
  const outline = outlineFor({ prompt: '帮我写一份面向新员工的产品使用手册', kind: '文档' })
  assert.equal(outline.audience, '新员工')
  assert.ok(outline.title.includes('产品使用手册'), '主题里应该留下被写的对象，实际 ' + outline.title)
  assert.ok(!outline.title.startsWith('帮我'), '壳子词要剥掉，实际 ' + outline.title)
})

test('outline: 标题与受众跟演示文稿共用同一份解析，命令词不进标题', () => {
  const doc = outlineFor({ prompt: '给产品团队做一份季度复盘，10章', kind: '文档' })
  assert.equal(doc.title, '季度复盘', '以前整句「给产品团队做一份季度复盘」都会进标题')
  assert.equal(doc.audience, '产品团队')

  const image = outlineFor({ prompt: '为新员工写一份产品使用手册', kind: '图片' })
  assert.equal(image.title, '产品使用手册')
  assert.equal(image.audience, '新员工', '「为 X」也是受众的说法，以前这里退回默认值')

  const carousel = outlineFor({ prompt: '做一份 6 屏的轮播图，讲通勤咖啡', kind: '轮播图' })
  assert.equal(carousel.title, '通勤咖啡', '第一句只剩类型词时，看下一句')
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
