const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SkillService } = require('../../dist/local/server/skills/service.js');
const { runtimeCatalog } = require('../../dist/local/server/skills/runtime-catalog.js');
const { skillPermissions } = require('../../dist/local/server/skills/skill-permissions.js');

const req = (path, method = 'GET') => new Request('http://local/api/' + path, { method });
const upload = (skillId, expertId, content, filename, parameters) => {
  const form = new FormData();
  form.set('skillId', skillId);
  form.set('expertId', expertId);
  form.set('file', new File([content], filename));
  form.set('consent', 'true');
  form.set('requestId', 'perm-' + Math.random().toString(36).slice(2, 12));
  if (parameters !== undefined) form.set('parameters', JSON.stringify(parameters));
  return new Request('http://local/api/skill-runs', { method: 'POST', body: form });
};

test('the catalogue declares the tool permissions every skill really uses', () => {
  const catalog = runtimeCatalog();
  assert.ok(catalog.length > 40, 'the catalogue is the real one');
  for (const skill of catalog) {
    assert.ok(Array.isArray(skill.permissions) && skill.permissions.length > 0, skill.id + ' declares its permissions');
    assert.ok(skill.permissions.includes('local.read'), skill.id + ' reads the uploaded file');
    assert.ok(skill.permissions.includes('local.write'), skill.id + ' writes its artifacts');
  }
  // Local skills must not claim network, process or third-party rights.
  for (const skill of catalog) {
    if (['data.connect', 'code.build', 'audio.transcribe-en', 'web.verify', 'test.browser', 'document.summarize', 'image.generate', 'collaboration.sync'].includes(skill.id)) continue;
    assert.deepEqual(skill.permissions, ['local.read', 'local.write'], skill.id + ' stays local');
  }
  assert.deepEqual(skillPermissions('web.verify'), ['local.read', 'local.write', 'network', 'subprocess']);
  assert.deepEqual(skillPermissions('code.build'), ['local.read', 'local.write', 'subprocess']);
  assert.deepEqual(skillPermissions('audio.transcribe-en'), ['local.read', 'local.write', 'subprocess']);
  assert.deepEqual(skillPermissions('data.connect'), ['local.read', 'local.write', 'network']);
  assert.deepEqual(skillPermissions('document.summarize'), ['local.read', 'local.write', 'external.ai']);
  assert.deepEqual(skillPermissions('image.generate'), ['local.read', 'local.write', 'external.image']);
  assert.deepEqual(skillPermissions('collaboration.sync'), ['local.read', 'local.write', 'external.calendar', 'external.email']);
});

test('the runtime endpoint publishes the permission set with the catalogue', async () => {
  const service = new SkillService(':memory:');
  try {
    const response = await service.handle(req('skill-runtime'), 'alice');
    assert.equal(response.status, 200);
    const body = await response.json();
    const summarize = body.skills.find(s => s.id === 'document.summarize');
    assert.ok(summarize, 'the catalogue is served');
    assert.ok(summarize.permissions.includes('external.ai'), 'the third-party model right is visible before running');
  } finally {
    service.close();
  }
});

test('a run keeps the skill version and the granted permissions in its governance record', async t => {
  const service = new SkillService(':memory:');
  t.after(() => service.close());
  const response = await service.handle(upload('code.inspect', 'developer', 'export const a = 1;\n', 'sample.js'), 'alice');
  assert.equal(response.status, 202);
  const queued = await response.json();
  assert.equal(queued.version, '1.0.0');
  assert.deepEqual(queued.permissions, ['local.read', 'local.write']);
  const record = await (await service.handle(req('skill-runs/' + queued.id), 'alice')).json();
  assert.equal(record.version, '1.0.0');
  assert.deepEqual(record.permissions, ['local.read', 'local.write']);
  // Another account cannot read the record.
  assert.equal((await service.handle(req('skill-runs/' + queued.id), 'bob')).status, 404);
});

test('a skill that hands content to a third party is refused without a single-run consent', async t => {
  const previousKey = process.env.AI_API_KEY;
  const previousBase = process.env.AI_BASE_URL;
  process.env.AI_API_KEY = 'test-key-not-a-real-credential';
  process.env.AI_BASE_URL = 'http://127.0.0.1:9/v1';
  t.after(() => {
    if (previousKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previousKey;
    if (previousBase === undefined) delete process.env.AI_BASE_URL; else process.env.AI_BASE_URL = previousBase;
  });
  const service = new SkillService(':memory:');
  t.after(() => service.close());
  const refused = await service.handle(
    upload('document.summarize', 'documents', '一段用于测试的正文。', 'note.txt', {}),
    'alice',
  );
  assert.equal(refused.status, 400);
  const message = (await refused.json()).error;
  assert.match(message, /授权/, 'the refusal explains that an explicit consent is required');
  assert.equal(
    (await service.handle(upload('document.summarize', 'documents', '一段用于测试的正文。', 'note.txt'), 'alice')).status,
    400,
    'a missing parameter is refused as well',
  );
});
