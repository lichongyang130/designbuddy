import test from 'node:test';
import assert from 'node:assert/strict';
import { skillPainpoints, skillModeLabels } from '../frontend/workspace/skillPainpointMap.ts';
import { categoriesForMode } from '../apps/web/src/components/promptLibrary.ts';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runtimeSkills } = require('../dist/local/shared/skillRuntime.js');
import { routingExperts } from '../shared/expertRouting.ts';

test('every homepage task category has a single declared expert skill scope', () => {
  for (const mode of ['office', 'design', 'code']) {
    const configured = skillPainpoints[mode];
    assert.equal(configured.length, categoriesForMode(mode).length, mode);
    assert.equal(new Set(configured.map(item => item.id)).size, configured.length, mode);
    for (const category of categoriesForMode(mode)) {
      const item = configured.find(entry => entry.id === category.id);
      assert.ok(item, `${mode}:${category.id}`);
      assert.equal(item.title, category.title);
      assert.ok(routingExperts.some(expert => expert.id === item.expertId), `${item.id}:${item.expertId}`);
      assert.equal(new Set(item.skillIds).size, item.skillIds.length, item.id);
      for (const id of item.skillIds) {
        const skill = runtimeSkills.find(entry => entry.id === id);
        assert.ok(skill, `${item.id}:${id}`);
        assert.ok(skill.expertIds.includes(item.expertId), `${item.id}:${id} is not bound to ${item.expertId}`);
      }
    }
  }
  assert.deepEqual(skillModeLabels, { office: '办公提效', design: '设计制作', code: '网页应用' });
});
test('unsupported categories do not inherit unrelated executors or claim transcription', () => {
  const get = (id) => Object.values(skillPainpoints).flat().find(item => item.id === id);
  assert.deepEqual(get('office-meetings').skillIds, []);
  assert.deepEqual(get('office-reports').skillIds, []);
  assert.deepEqual(get('office-email').skillIds, ['email.marketing']);
  assert.ok(get('office-email').summary.includes('不自动发送'));
  assert.ok(!get('office-meetings').skillIds.includes('audio.transcribe-en'));
  assert.ok(get('office-followup').summary.includes('未接入'));
  assert.ok(get('web-tools').skillIds.includes('code.build'));
  assert.equal(runtimeSkills.find(skill => skill.id === 'code.build').status, 'unavailable');
});
