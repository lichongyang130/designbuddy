import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createModelRouterFromEnv } from './ProviderConfig';

test('provider config reads model and endpoint from environment without exposing secrets', async () => {
  const router = createModelRouterFromEnv({
    OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'gpt-test',
    OPENAI_BASE_URL: 'https://example.invalid/v1', LLM_DEFAULT_PROVIDER: 'openai',
  });
  const models = await router.discoverModels();
  assert.equal(models.length, 1);
  assert.equal(models[0].model, 'gpt-test');
  assert.equal(models[0].provider, 'openai');
});
