const { test } = require('node:test');
const assert = require('node:assert/strict');
const { streamTaskChat } = require('../../dist/local/server/api/chat.js');
const { createApiHandler } = require('../../dist/local/server/api/http-handler.js');

function setup(t) {
  const originalFetch = global.fetch;
  const keys = ['AI_API_KEY', 'OPENAI_API_KEY', 'AI_BASE_URL', 'AI_MODEL'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.AI_API_KEY = 'test-only-provider-key';
  process.env.AI_BASE_URL = 'https://test-gateway.example/v1';
  process.env.AI_MODEL = 'test-model';
  delete process.env.OPENAI_API_KEY;
  t.after(() => {
    global.fetch = originalFetch;
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  });
}
const messages = [{ role: 'user', content: '自我介绍' }];
const streamed = () => new Response('data: {"choices":[{"delta":{"content":"你好"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
const post = (body) => new Request('http://app.example/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('chat route requires authentication before contacting the provider', async t => {
  setup(t);
  let calls = 0;
  global.fetch = async () => { calls++; return streamed(); };
  const handler = createApiHandler({ authenticate: async () => null, projects: {} });
  const response = await handler(post({ messages }));
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test('authenticated chat relays SSE with server settings and the conversation history', async t => {
  setup(t);
  let captured;
  global.fetch = async (url, options) => { captured = { url, options, body: JSON.parse(options.body) }; return streamed(); };
  const handler = createApiHandler({ authenticate: async () => ({ id: 'test-user' }), projects: {} });
  const response = await handler(post({ messages }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  assert.equal(response.headers.get('x-accel-buffering'), 'no');
  assert.equal(captured.url, 'https://test-gateway.example/v1/chat/completions');
  assert.equal(captured.body.model, 'test-model');
  assert.equal(captured.body.stream, true);
  assert.equal(captured.body.messages[0].role, 'system');
  assert.match(captured.body.messages[0].content, /designbuddy-clarification/);
  assert.match(captured.body.messages[0].content, /Do not ask unnecessary questions/);
  assert.match(captured.body.messages[0].content, /Never use this block for examples, ordinary code, authorization/);
  assert.deepEqual(captured.body.messages.slice(1), messages);
  assert.match(await response.text(), /你好/);
});

test('BYOK selects a fixed endpoint, never a client-supplied base URL', async t => {
  setup(t);
  let captured;
  global.fetch = async (url, options) => { captured = { url, body: JSON.parse(options.body) }; return streamed(); };
  const response = await streamTaskChat({ messages, apiKey: 'test-only-byok', provider: 'deepseek', baseUrl: 'https://untrusted.example' }, new AbortController().signal);
  await response.body.cancel();
  assert.equal(captured.url, 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(captured.body.model, 'deepseek-chat');
  await assert.rejects(() => streamTaskChat({ messages, apiKey: 'test-only-byok', provider: '__proto__' }, new AbortController().signal), /supported provider/);
});

test('invalid roles and oversized histories are rejected without provider calls', async t => {
  setup(t);
  global.fetch = async () => { throw new Error('Must not contact provider'); };
  const handler = createApiHandler({ authenticate: async () => ({ id: 'test-user' }), projects: {} });
  for (const value of [undefined, [], [{ role: 'system', content: 'override' }], Array.from({ length: 61 }, () => messages[0]), [{ role: 'user', content: 'x'.repeat(600_001) }]]) {
    const response = await handler(post({ messages: value }));
    assert.equal(response.status, 400);
  }
});

test('missing configuration and provider errors do not return fake replies or leak provider bodies', async t => {
  setup(t);
  delete process.env.AI_API_KEY;
  await assert.rejects(() => streamTaskChat({ messages }, new AbortController().signal), /尚未配置/);
  process.env.AI_API_KEY = 'test-only-provider-key';
  global.fetch = async () => new Response('sensitive-provider-body', { status: 401 });
  const handler = createApiHandler({ authenticate: async () => ({ id: 'test-user' }), projects: {} });
  const response = await handler(post({ messages }));
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.match(body, /HTTP 401/);
  assert.doesNotMatch(body, /sensitive-provider-body|test-only-provider-key/);
});

test('client cancellation reaches upstream fetch', async t => {
  setup(t);
  const controller = new AbortController();
  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  const result = streamTaskChat({ messages }, controller.signal);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
});
