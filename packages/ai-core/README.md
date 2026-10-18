# AI Core: Model Routing

Configure credentials through environment variables; do not put real secrets in source control.
See the repository root `.env.example` for supported provider keys and model overrides.

```ts
import { createModelRouterFromEnv } from './providers/ProviderConfig';
import { AgentRuntime } from './runtime/AgentRuntime';

const modelRouter = createModelRouterFromEnv();
await modelRouter.discoverModels();
const runtime = new AgentRuntime({ modelRouter, systemPrompt: 'You are a helpful assistant.' });
runtime.createTask({ id: 'demo', input: 'Summarize model routing.', status: 'pending' });
const task = await runtime.run('demo');
console.log(task.result, task.execution);
```

Provider registration is credential-gated. Token counts are provider-reported when available and otherwise marked as estimated. Fallback is attempted only for retryable errors.
