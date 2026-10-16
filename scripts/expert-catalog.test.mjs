import test from 'node:test';
import assert from 'node:assert/strict';
import { routingExperts, validProfiles, expertExecutionBrief, localExpertSuggestion } from '../shared/expertRouting.ts';
import { allPromptTasks, categoriesForMode, chineseCharacterCount } from '../apps/web/src/components/promptLibrary.ts';

test('one catalog contains 16 task-focused experts, including dedicated office specialists and triage', () => {
  assert.equal(routingExperts.length, 16);
  assert.equal(new Set(routingExperts.map(e => e.id)).size, 16);
  assert.equal(new Set(routingExperts.map(e => e.name)).size, 16);
  assert.ok(validProfiles(routingExperts));
  assert.equal(routingExperts.filter(e => e.mode === 'office').length, 8);
  assert.equal(routingExperts.filter(e => e.mode === 'design').length, 4);
  assert.equal(routingExperts.filter(e => e.mode === 'code').length, 4);
  assert.deepEqual(routingExperts.map(e => e.name), ['文档整理专家','数据分析专家','汇报提案专家','工作协作专家','品牌视觉专家','营销物料专家','产品展示专家','信息可视化专家','产品需求专家','网页交互专家','全栈开发专家','会议纪要专家','周报总结专家','资料总结专家','问题分诊专家','测试验收专家']);
  assert.doesNotMatch(JSON.stringify(routingExperts), /高校创业导师|升学备考通|腾讯专家|专家团|popularity/);
});
test('all 31 homepage categories are covered and expert examples reuse complete existing tasks', () => {
  for (const mode of ['office','design','code']) {
    const covered = routingExperts.filter(e => e.mode === mode).flatMap(e => e.homeCategories);
    for (const category of categoriesForMode(mode)) assert.ok(covered.includes(category.title), category.title);
  }
  for (const expert of routingExperts) {
    assert.equal(expert.taskIds.length, 3);
    for (const id of expert.taskIds) {
      const task = allPromptTasks.find(t => t.id === id);
      assert.ok(task, id);
      assert.equal(task.mode, expert.mode, id);
      assert.ok(expert.homeCategories.includes(task.category), id);
      assert.ok(chineseCharacterCount(task.prompt) >= 200);
    }
  }
});
test('every expert has concrete inputs, methods, deliverables, checks and honest tool limits', () => {
  for (const expert of routingExperts) {
    for (const field of ['materials','method','deliverables','checks']) assert.ok(expert[field].length >= 3, `${expert.id}:${field}`);
    assert.ok(expert.limits.length > 30);
    const brief = expertExecutionBrief(expert);
    assert.ok(brief.includes(expert.name));
    assert.ok(brief.includes(expert.method[1]));
    assert.ok(brief.includes(expert.checks[1]));
  }
  assert.equal(localExpertSuggestion('整理设计部门报销表').id, 'data');
  assert.equal(localExpertSuggestion('品牌物料').id, 'brand');
  assert.equal(localExpertSuggestion('商品主图').id, 'product-visual');
  assert.equal(localExpertSuggestion('整理会议纪要和待办').id, 'meeting');
  assert.equal(localExpertSuggestion('根据工作记录写周报').id, 'weekly');
  assert.equal(localExpertSuggestion('总结我提供的调研资料').id, 'research-summary');
  assert.equal(localExpertSuggestion('我不知道这个问题怎么分类').id, 'triage');
});
