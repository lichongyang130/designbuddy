import test from 'node:test';
import assert from 'node:assert/strict';
import { initialUIQuestions, parseClarification, isClarificationStream, makeClarification, validClarification, validQuestions, answerComplete, clarificationSummary } from '../frontend/workspace/taskClarification.ts';
const questions = [{ id: 'platform', title: '这个 UI 大概是什么形态？', options: ['网页页面', '微信小程序', '先讨论'] }];
const wrap = (q) => '```designbuddy-clarification\n' + JSON.stringify({ questions: q }) + '\n```';

test('only underspecified UI requests get the conservative local guard', () => {
  assert.equal(initialUIQuestions('帮我做一个UI').length, 2);
  assert.equal(initialUIQuestions('帮我设计界面').length, 2);
  for (const text of ['自我介绍', '解释一下UI是什么', '设计一个首页', '做一个React登录界面', '帮我设计微信小程序UI', '帮我做一个UI需求方案', '做个网页界面']) assert.equal(initialUIQuestions(text), null, text);
});
test('structured protocol validates bounds and rejects duplicates and arbitrary JSON', () => {
  assert.deepEqual(parseClarification(wrap(questions)), questions);
  assert.equal(parseClarification('普通回答'), null);
  assert.equal(parseClarification('```json\n{}\n```'), null);
  for (const q of [[], [...questions, ...questions], [{ ...questions[0], options: ['one'] }], [{ ...questions[0], options: ['one', 'one'] }], [{ ...questions[0], options: ['one', 'two', 'three', 'four', 'five'] }], [{ ...questions[0], title: 'x'.repeat(201) }], [{ ...questions[0], id: '<script>' }], Array(5).fill(questions[0])]) assert.throws(() => parseClarification(wrap(q)), /格式无效/);
  assert.throws(() => parseClarification('```designbuddy-clarification\n{bad}\n```'), /格式无效/);
  assert.throws(() => parseClarification(wrap(questions).slice(0, -3)), /格式无效/);
  assert.equal(validQuestions(null), false);
});
test('streaming protocol prefixes are buffered but normal text is streamed', () => {
  const block = wrap(questions);
  for (let i = 1; i <= block.length; i++) assert.equal(isClarificationStream(block.slice(0, i)), true);
  assert.equal(isClarificationStream('你好'), false);
  assert.equal(isClarificationStream('```html'), false);
});
test('choice and custom answers are retained; permission requires an explicit choice', () => {
  const c = makeClarification('user-1', questions);
  assert.equal(validClarification(c), true);
  assert.equal(answerComplete(c, 0), false);
  c.answers[0].note = '  ';
  assert.equal(answerComplete(c, 0), false);
  c.answers[0].note = '另一个平台';
  assert.equal(answerComplete(c, 0), true);
  c.answers[0].option = 1;
  assert.match(clarificationSummary(c), /微信小程序；补充：另一个平台/);
  assert.equal(answerComplete({ ...c, kind: 'permission', answers: [{ option: null, note: 'yes' }] }, 0), false);
});
test('invalid persisted state fails closed', () => {
  const c = makeClarification('user-1', questions);
  for (const value of [{ ...c, page: -1 }, { ...c, page: 1 }, { ...c, state: 'execute' }, { ...c, answers: [] }, { ...c, answers: [{ option: 7, note: '' }] }, { ...c, answers: [{ option: null, note: 'x'.repeat(2001) }] }, { ...c, questions: null }]) assert.equal(validClarification(value), false);
});
