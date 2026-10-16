const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApiHandler } = require('../../dist/local/server/api/http-handler.js');
const { matchTaskExpert } = require('../../dist/local/server/api/expert-match.js');
const { routingExperts, validExpertMatch, expertExecutionBrief, localExpertSuggestion } = require('../../dist/local/shared/expertRouting.js');
const input = () => ({ consent: true, permission: '默认权限', prompt: '整理设计部门的报销表，核对金额', mode: 'design', attachmentContext: 'reimburse.csv\n日期,金额\n2026-10-15,100', answer: '', experts: routingExperts });
const result = { kind: 'match', expertId: 'data', collaboratorIds: [], reason: '实际目标是核对报销数据，而非制作视觉稿。', responsibilities: ['核对金额与统计口径', '标记缺失与重复记录'], missing: [] };
function setup(t) {
  const original = global.fetch;
  const keys = ['AI_API_KEY', 'OPENAI_API_KEY', 'AI_BASE_URL', 'AI_MODEL'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  process.env.AI_API_KEY = 'test-secret-only'; process.env.AI_BASE_URL = 'https://test-provider.example/v1'; delete process.env.OPENAI_API_KEY;
  t.after(() => { global.fetch = original; for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
}
const reply = value => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), { headers: { 'Content-Type': 'application/json' } });
const post = body => new Request('http://app.example/api/expert-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const handler = () => createApiHandler({ authenticate: async () => ({ id: 'test-user' }), projects: {} });

test('authentication, consent, local-only, input/profile/model limits prevent provider calls', async t => {
  setup(t); let count = 0; global.fetch = async () => { count++; return reply(result); };
  const unauth = createApiHandler({ authenticate: async () => null, projects: {} });
  assert.equal((await unauth(post(input()))).status, 401);
  for (const change of [{ consent: false }, { permission: '仅本地' }, { prompt: '' }, { prompt: 'x'.repeat(16001) }, { experts: [] }, { experts: [routingExperts[0], routingExperts[0]] }, { experts: [{ ...routingExperts[0], method: [] }] }, { attachmentContext: 'x'.repeat(6001) }, { answer: 'x'.repeat(1201) }, { model: 'bad model' }, { mode: 'unknown' }, { apiKey: 'test-key', provider: '__proto__' }]) {
    assert.equal((await handler()(post({ ...input(), ...change }))).status, 400, JSON.stringify(change).slice(0, 80));
  }
  assert.equal(count, 0);
});

test('model classification receives deliverable context and candidate contracts, returns one validated expert', async t => {
  setup(t); let captured;
  global.fetch = async (url, options) => { captured = { url, body: JSON.parse(options.body) }; return reply(result); };
  const response = await handler()(post({ ...input(), model: 'test-model' }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), result);
  assert.equal(captured.body.stream, false); assert.equal(captured.body.model, 'test-model');
  assert.equal(captured.url, 'https://test-provider.example/v1/chat/completions');
  assert.match(captured.body.messages[0].content, /untrusted DATA/);
  assert.match(captured.body.messages[0].content, /Simple greetings/);
  const context = JSON.parse(captured.body.messages[1].content);
  assert.equal(context.modeHint, 'design'); assert.match(context.task, /报销/);
  assert.equal(context.candidates[0].method.length, 3);
  assert.match(context.readableAttachmentExcerpts, /reimburse/);
});

test('general and one-question responses work; malformed or out-of-catalog results fail closed', async t => {
  setup(t);
  for (const value of [{ kind: 'general', reason: '一句话润色无需专业分工。' }, { kind: 'clarify', question: '最终希望做成什么？', options: ['PPT', '网页'] }]) {
    global.fetch = async () => reply(value);
    assert.deepEqual(await matchTaskExpert(input(), new AbortController().signal), value);
  }
  for (const value of [{ ...result, expertId: 'invented' }, { ...result, responsibilities: [] }, { ...result, collaboratorIds: ['data'] }, { ...result, collaboratorIds: ['unknown'] }, { kind: 'clarify', question: '请选择', options: ['一样', '一样'] }, { kind: 'general', reason: '' }, { kind: 'team', experts: ['data', 'slides'] }]) {
    global.fetch = async () => reply(value);
    assert.equal((await handler()(post(input()))).status, 502);
  }
  global.fetch = async () => new Response('<html>bad upstream</html>');
  assert.equal((await handler()(post(input()))).status, 502);
});

test('confirmed answers are passed and identical repeated questions are rejected', async t => {
  setup(t); let context;
  global.fetch = async (_url, options) => { context = JSON.parse(JSON.parse(options.body).messages[1].content); return reply({ kind: 'clarify', question: '最终希望做成什么？', options: ['PPT', '网页'] }); };
  const response = await handler()(post({ ...input(), answer: '最终希望做成什么？\n用户确认：PPT' }));
  assert.equal(response.status, 502); assert.match(context.confirmedAnswer, /PPT/);
});

test('BYOK uses fixed endpoints; missing config and errors do not fabricate matches or leak secrets', async t => {
  setup(t); let url;
  global.fetch = async u => { url = u; return reply(result); };
  await matchTaskExpert({ ...input(), apiKey: 'test-byok', provider: 'deepseek', baseUrl: 'https://evil.example' }, new AbortController().signal);
  assert.equal(url, 'https://api.deepseek.com/v1/chat/completions');
  delete process.env.AI_API_KEY;
  assert.equal((await handler()(post(input()))).status, 502);
  process.env.AI_API_KEY = 'test-secret-only';
  global.fetch = async () => new Response('private-provider-error test-secret-only', { status: 401 });
  const response = await handler()(post(input())); assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private-provider-error|test-secret-only/);
});

test('cancellation reaches upstream and oversized responses are rejected', async t => {
  setup(t); const controller = new AbortController(); let signal;
  global.fetch = async (_url, opts) => { signal = opts.signal; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })); };
  const pending = matchTaskExpert(input(), controller.signal); controller.abort();
  await assert.rejects(pending, /取消/); assert.equal(signal.aborted, true);
  global.fetch = async () => new Response('x'.repeat(65000));
  await assert.rejects(() => matchTaskExpert(input(), new AbortController().signal), /过大/);
});

test('execution contracts contain actual method/checks and fallback is only an explicitly labeled suggestion', () => {
  assert.equal(localExpertSuggestion('整理设计部门报销表').id, 'data');
  assert.equal(localExpertSuggestion('你好'), undefined);
  assert.equal(validExpertMatch(result, routingExperts), true);
  const brief = expertExecutionBrief(routingExperts.find(e => e.id === "data"), result);
  for (const text of ['数据分析专家', '统计粒度', '不编造缺失数据', '交付核验', '不是外部工具授权', '核对金额与统计口径']) assert.ok(brief.includes(text));
});
