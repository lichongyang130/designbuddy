import { ClaudeProvider } from './ClaudeProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { ModelRouter, ModelRouterOptions } from './ModelRouter';
import { OpenAIProvider } from './OpenAIProvider';
import { ProviderConfig, ProviderId } from './ModelProvider';

type Environment = Record<string, string | undefined>;

function readProviderConfig(env: Environment, prefix: string, defaults: ProviderConfig): ProviderConfig {
  return {
    ...defaults,
    apiKey: env[`${prefix}_API_KEY`],
    baseUrl: env[`${prefix}_BASE_URL`] || defaults.baseUrl,
    defaultModel: env[`${prefix}_MODEL`] || defaults.defaultModel,
    timeoutMs: env[`${prefix}_TIMEOUT_MS`] ? Number(env[`${prefix}_TIMEOUT_MS`]) : defaults.timeoutMs,
  };
}

/** Reads secrets from environment variables without logging or persisting them. */
export function createModelRouterFromEnv(
  env: Environment = ((globalThis as { process?: { env?: Environment } }).process?.env ?? {}),
  options: ModelRouterOptions = {},
): ModelRouter {
  const openai = readProviderConfig(env, 'OPENAI', {
    baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4.1-mini', timeoutMs: 60_000,
  });
  const claude = readProviderConfig(env, 'ANTHROPIC', {
    baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-7-sonnet-latest', timeoutMs: 60_000,
  });
  const deepseek = readProviderConfig(env, 'DEEPSEEK', {
    baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', timeoutMs: 60_000,
  });
  const router = new ModelRouter({
    ...options,
    defaultProvider: (env.LLM_DEFAULT_PROVIDER as ProviderId | undefined) ?? options.defaultProvider,
    fallbackOrder: (env.LLM_FALLBACK_ORDER?.split(',').map(v => v.trim()).filter(Boolean) as ProviderId[] | undefined) ?? options.fallbackOrder,
  });
  if (openai.apiKey) router.registerProvider(new OpenAIProvider(openai));
  if (claude.apiKey) router.registerProvider(new ClaudeProvider(claude));
  if (deepseek.apiKey) router.registerProvider(new DeepSeekProvider(deepseek));
  return router;
}
