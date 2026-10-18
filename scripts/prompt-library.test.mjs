import test from 'node:test';
import assert from 'node:assert/strict';
import { promptCategories, categoriesForMode, allPromptTasks, chineseCharacterCount, recommendPrompts, readPromptUsage, recordPromptUse } from '../apps/web/src/components/promptLibrary.ts';

test('catalog has independent mode categories, meaningful subgroups and unique IDs', () => {
  assert.equal(promptCategories.length, 31);
  assert.equal(allPromptTasks.length, 248);
  assert.equal(new Set(allPromptTasks.map(t => t.id)).size, 248);
  assert.equal(new Set(allPromptTasks.map(t => t.prompt)).size, 248);
  for (const mode of ['office', 'code', 'design']) {
    const categories = categoriesForMode(mode);
    assert.equal(categories.length, mode === 'office' ? 11 : 10);
    for (const c of categories) {
      assert.equal(c.groups.length, 2);
      assert.equal(c.groups.flatMap(g => g.tasks).length, 8);
      for (const g of c.groups) {
        assert.equal(g.tasks.length, 4);
        assert.ok(g.tasks.every(t => t.mode === mode && t.category === c.title && t.group === g.title));
      }
    }
  }
});
test('every prompt has at least 200 Chinese characters and complete task instructions', () => {
  for (const t of allPromptTasks) {
    assert.ok(chineseCharacterCount(t.prompt) >= 200, t.id);
    for (const field of [t.title, '任务目标：', '具体要求：', '工作方式：', '质量与交付要求：']) assert.ok(t.prompt.includes(field), t.id);
    assert.ok(t.description.length > 20, t.id);
  }
  console.log('Minimum Chinese characters:', Math.min(...allPromptTasks.map(t => chineseCharacterCount(t.prompt))));
});
test('query relevance and saved usage affect ordering without mutating source tasks', () => {
  const tasks = promptCategories[0].groups[0].tasks;
  const original = tasks.map(t => t.id);
  assert.equal(recommendPrompts(tasks, '请做政策条款速读', {})[0].title, '政策条款速读');
  const favorite = tasks[3];
  assert.equal(recommendPrompts(tasks, '', { [favorite.id]: { count: 3, lastUsed: Date.now() } })[0].id, favorite.id);
  assert.deepEqual(tasks.map(t => t.id), original);
});
test('every subgroup rotates through all tasks with no adjacent-batch overlap', () => {
  for (const group of promptCategories.flatMap(c => c.groups)) {
    let batch = recommendPrompts(group.tasks, '', {}), seen = batch.map(t => t.id);
    for (let i = 0; i < 4; i++) {
      const next = recommendPrompts(group.tasks, '', {}, seen, batch.map(t => t.id));
      assert.equal(next.length, 2);
      assert.ok(next.every(t => !batch.some(prev => prev.id === t.id)));
      seen = [...new Set([...seen, ...next.map(t => t.id)])];
      batch = next;
    }
    assert.equal(seen.length, 4);
  }
});
test('corrupt or unavailable recommendation storage does not block prompt use', () => {
  let value = '{bad';
  globalThis.localStorage = { getItem: () => value, setItem: (_, data) => { value = data; } };
  assert.deepEqual(readPromptUsage(), {});
  recordPromptUse(allPromptTasks[0].id);
  assert.equal(readPromptUsage()[allPromptTasks[0].id].count, 1);
  assert.ok(!value.includes('任务目标'));
  globalThis.localStorage = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
  assert.doesNotThrow(() => recordPromptUse(allPromptTasks[0].id));
  delete globalThis.localStorage;
});

test('approved taxonomy contains exactly the 31 named categories and stable featured five', () => {
  const expected = {
    office: ['文档整理', '数据表格', '会议纪要', '周报总结', '汇报PPT', '邮件沟通', '计划排期', '调研分析', '流程规范', '协作跟进', '其他问题'],
    design: ['海报配图', '产品展示', '社媒内容', '品牌物料', '信息图表', '电商物料', '宣传长图', '演示美化', '视觉方案', '图片优化'],
    code: ['企业官网', '活动页面', '产品原型', '数据看板', '实用工具', '作品展示', '商品服务', '表单收集', '业务后台', '内容站点'],
  };
  for (const [mode, titles] of Object.entries(expected)) {
    assert.deepEqual(categoriesForMode(mode).map(c => c.title), titles);
    assert.equal(allPromptTasks.filter(t => t.mode === mode).length, mode === 'office' ? 88 : 80);
  }
  assert.equal(new Set(allPromptTasks.map(t => t.title)).size, 248);
  assert.equal(new Set(promptCategories.map(c => c.id)).size, 31);
  assert.equal(new Set(promptCategories.flatMap(c => c.groups.map(g => g.id))).size, 62);
});
