import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AgentRuntime } from './AgentRuntime';
import { ModelRouter } from '../providers/ModelRouter';
import { ModelProvider, ModelRequest, ModelResponse, ProviderError } from '../providers/ModelProvider';

function mockProvider(id: string, result: string | Error): ModelProvider {
  return {
    id, config: {},
    async complete(request: ModelRequest): Promise<ModelResponse> {
      if (result instanceof Error) throw result;
      return { id: `mock-${id}`, provider: id, model: request.model ?? 'mock-model', content: result,
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7, estimated: false }, latencyMs: 2 };
    },
    async listModels() {
      return [{ id: `${id}:mock-model`, provider: id, model: 'mock-model',
        capabilities: ['chat', 'coding'], priority: 10, enabled: true }];
    },
  };
}

test('AgentRuntime calls the router and records response and token usage', async () => {
  const router = new ModelRouter().registerProvider(mockProvider('openai', 'hello'));
  await router.discoverModels();
  const runtime = new AgentRuntime({ modelRouter: router });
  runtime.createTask({ id: 'task-1', input: 'say hello', status: 'pending' });
  const task = await runtime.run('task-1');
  assert.equal(task.status, 'completed');
  assert.equal(task.result, 'hello');
  assert.equal(task.execution?.[0].totalTokens, 7);
});

test('router falls back after retryable provider failure', async () => {
  const router = new ModelRouter({ fallbackOrder: ['openai', 'claude'] })
    .registerProvider(mockProvider('openai', new ProviderError('rate limited', 'openai', 429, true)))
    .registerProvider(mockProvider('claude', 'fallback response'));
  await router.discoverModels();
  const result = await router.complete({ messages: [{ role: 'user', content: 'hi' }], requiredCapabilities: ['chat'] });
  assert.equal(result.provider, 'claude');
  assert.equal(result.content, 'fallback response');
  assert.equal(router.getStats().successes, 1);
});

test('provider error ownership is normalized at router boundary', async () => {
  const wrongProvider = mockProvider('openai', new ProviderError('upstream down', 'claude', 503, true));
  const router = new ModelRouter().registerProvider(wrongProvider);
  await router.discoverModels();
  await assert.rejects(
    () => router.complete({ messages: [{ role: 'user', content: 'hi' }], provider: 'openai' }),
    (error: unknown) => error instanceof ProviderError && error.provider === 'openai',
  );
});

test('environment factory does not register providers without API keys', async () => {
  const { createModelRouterFromEnv } = await import('../providers/ProviderConfig');
  const router = createModelRouterFromEnv({});
  assert.equal((await router.discoverModels()).length, 0);
});
