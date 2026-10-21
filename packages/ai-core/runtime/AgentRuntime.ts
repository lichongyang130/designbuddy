import { ModelRouter, RouteRequest } from '../providers/ModelRouter';
import { ChatMessage, ModelCapability, ModelResponse, ProviderError, ProviderId } from '../providers/ModelProvider';

export type AgentTaskStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentTask {
  id: string;
  ownerId?: string;
  projectId?: string;
  input: unknown;
  status: AgentTaskStatus;
  provider?: ProviderId;
  model?: string;
  requiredCapabilities?: ModelCapability[];
  attempts?: number;
  maxRetries?: number;
  idempotencyKey?: string;
  result?: string;
  error?: string;
  createdAt?: number;
  updatedAt?: number;
  startedAt?: number;
  completedAt?: number;
  execution?: AgentExecutionRecord[];
}

export interface AgentExecutionRecord {
  attempt?: number;
  startedAt: number;
  completedAt: number;
  status: 'succeeded' | 'failed' | 'cancelled';
  provider?: ProviderId;
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  usageEstimated?: boolean;
  error?: { name: string; message: string; provider?: ProviderId; status?: number; retryable?: boolean };
}

/**
 * Pluggable persistence adapter so AgentRuntime survives process restarts when
 * backed by SQLite or another durable store, while remaining zero-dependency in
 * unit tests via InMemoryAgentTaskStore.
 */
export interface AgentTaskStore {
  get(taskId: string): AgentTask | undefined;
  put(task: AgentTask): void;
  list(ownerId?: string): AgentTask[];
  delete(taskId: string): boolean;
  findByIdempotencyKey?(ownerId: string, key: string): AgentTask | undefined;
}

export class InMemoryAgentTaskStore implements AgentTaskStore {
  private readonly map = new Map<string, AgentTask>();

  get(taskId: string): AgentTask | undefined {
    const found = this.map.get(taskId);
    return found ? structuredClone(found) : undefined;
  }

  put(task: AgentTask): void {
    this.map.set(task.id, structuredClone(task));
  }

  list(ownerId?: string): AgentTask[] {
    const items = Array.from(this.map.values());
    return (ownerId ? items.filter(t => t.ownerId === ownerId) : items).map(t => structuredClone(t));
  }

  delete(taskId: string): boolean {
    return this.map.delete(taskId);
  }

  findByIdempotencyKey(ownerId: string, key: string): AgentTask | undefined {
    for (const item of this.map.values()) {
      if (item.ownerId === ownerId && item.idempotencyKey === key) return structuredClone(item);
    }
    return undefined;
  }
}

export interface AgentRuntimeOptions {
  modelRouter?: ModelRouter;
  store?: AgentTaskStore;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  defaultMaxRetries?: number;
  retryDelayMs?: number;
}

function inputToMessages(input: unknown, systemPrompt?: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  if (typeof input === 'string') messages.push({ role: 'user', content: input });
  else if (input && typeof input === 'object' && 'messages' in input && Array.isArray((input as { messages: unknown }).messages)) {
    for (const item of (input as { messages: unknown[] }).messages) {
      if (item && typeof item === 'object' && 'role' in item && 'content' in item) {
        const message = item as { role: unknown; content: unknown };
        if (['system', 'user', 'assistant'].includes(String(message.role)) && typeof message.content === 'string') {
          messages.push({ role: message.role as ChatMessage['role'], content: message.content });
        }
      }
    }
  } else messages.push({ role: 'user', content: JSON.stringify(input) });
  if (!messages.some(message => message.role === 'user')) {
    throw new Error('Agent task input must contain a user message');
  }
  return messages;
}

export class AgentRuntime {
  private readonly store: AgentTaskStore;
  private readonly controllers = new Map<string, AbortController>();
  private readonly modelRouter?: ModelRouter;
  private readonly options: AgentRuntimeOptions;

  constructor(options: AgentRuntimeOptions = {}) {
    this.options = options;
    this.modelRouter = options.modelRouter;
    this.store = options.store ?? new InMemoryAgentTaskStore();
    this.recoverInterruptedTasks();
  }

  /**
   * Any task left in `running` when a new runtime boots was interrupted by a
   * crash or restart. Never leave phantom running tasks or claim completion.
   */
  recoverInterruptedTasks(): number {
    let recovered = 0;
    const now = Date.now();
    for (const task of this.store.list()) {
      if (task.status === 'running') {
        task.status = 'failed';
        task.error = 'Task was interrupted by process restart before completion; explicit retry required.';
        task.updatedAt = now;
        task.completedAt = now;
        this.store.put(task);
        recovered += 1;
      }
    }
    return recovered;
  }

  createTask(task: AgentTask): AgentTask {
    if (!task.id) throw new Error('Task id is required');
    if (task.ownerId && task.idempotencyKey && this.store.findByIdempotencyKey) {
      const existing = this.store.findByIdempotencyKey(task.ownerId, task.idempotencyKey);
      if (existing) return existing;
    }
    const now = Date.now();
    const normalized: AgentTask = {
      ...task,
      status: task.status ?? 'pending',
      attempts: task.attempts ?? 0,
      maxRetries: task.maxRetries ?? this.options.defaultMaxRetries ?? 0,
      createdAt: task.createdAt ?? now,
      updatedAt: now,
      execution: task.execution ?? [],
    };
    this.store.put(normalized);
    return normalized;
  }

  async run(taskId: string, externalSignal?: AbortSignal): Promise<AgentTask> {
    const task = this.store.get(taskId);
    if (!task) throw new Error('Task not found');
    if (!this.modelRouter) {
      task.status = 'failed';
      task.error = 'ModelRouter is not configured';
      task.updatedAt = Date.now();
      this.store.put(task);
      throw new Error(task.error);
    }
    if (task.status === 'paused') throw new Error('Task is paused; call resume before running it');

    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
    this.controllers.set(taskId, controller);

    const maxAttempts = Math.max(1, 1 + (task.maxRetries ?? this.options.defaultMaxRetries ?? 0));
    const retryDelayMs = this.options.retryDelayMs ?? 150;
    let lastError: unknown;

    try {
      for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
        if (controller.signal.aborted) {
          const cancelledAt = Date.now();
          task.status = 'cancelled';
          task.error = 'Task execution cancelled';
          task.updatedAt = cancelledAt;
          task.completedAt = cancelledAt;
          task.execution!.push({
            attempt: (task.attempts ?? 0) + 1,
            startedAt: cancelledAt,
            completedAt: cancelledAt,
            status: 'cancelled',
            latencyMs: 0,
            error: { name: 'AbortError', message: task.error, retryable: false },
          });
          this.store.put(task);
          throw new Error(task.error);
        }

        const startedAt = Date.now();
        task.status = 'running';
        task.startedAt ??= startedAt;
        task.updatedAt = startedAt;
        task.attempts = (task.attempts ?? 0) + 1;
        task.error = undefined;
        this.store.put(task);

        try {
          const route: RouteRequest = {
            messages: inputToMessages(task.input, this.options.systemPrompt),
            provider: task.provider,
            preferredModel: task.model,
            requiredCapabilities: task.requiredCapabilities ?? ['chat'],
            temperature: this.options.temperature,
            maxTokens: this.options.maxTokens,
          };
          const response: ModelResponse = await Promise.race([
            this.modelRouter.complete(route),
            new Promise<never>((_, reject) => {
              if (controller.signal.aborted) {
                reject(Object.assign(new Error('Task execution cancelled'), { name: 'AbortError' }));
                return;
              }
              controller.signal.addEventListener(
                'abort',
                () => reject(Object.assign(new Error('Task execution cancelled'), { name: 'AbortError' })),
                { once: true },
              );
            }),
          ]);
          const finishedAt = Date.now();
          task.result = response.content;
          task.provider = response.provider;
          task.model = response.model;
          task.status = 'completed';
          task.updatedAt = finishedAt;
          task.completedAt = finishedAt;
          task.execution!.push({
            attempt: task.attempts,
            startedAt,
            completedAt: finishedAt,
            status: 'succeeded',
            provider: response.provider,
            model: response.model,
            latencyMs: response.latencyMs,
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            totalTokens: response.usage.totalTokens,
            usageEstimated: response.usage.estimated,
          });
          this.store.put(task);
          return task;
        } catch (error) {
          lastError = error;
          const finishedAt = Date.now();
          const isAbort = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
          const providerError = error instanceof ProviderError ? error : undefined;
          const retryable = !isAbort && (providerError ? providerError.retryable : false);
          task.status = isAbort ? 'cancelled' : 'failed';
          task.error = error instanceof Error ? error.message : 'Unknown agent execution error';
          task.updatedAt = finishedAt;
          task.completedAt = finishedAt;
          task.execution!.push({
            attempt: task.attempts,
            startedAt,
            completedAt: finishedAt,
            status: isAbort ? 'cancelled' : 'failed',
            latencyMs: finishedAt - startedAt,
            error: {
              name: error instanceof Error ? error.name : 'UnknownError',
              message: task.error,
              provider: providerError?.provider,
              status: providerError?.status,
              retryable,
            },
          });
          this.store.put(task);

          if (!retryable || attemptIndex + 1 >= maxAttempts) {
            throw error;
          }
          if (retryDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attemptIndex + 1)));
          }
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Agent execution failed');
    } finally {
      this.controllers.delete(taskId);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  cancel(taskId: string): AgentTask | undefined {
    const controller = this.controllers.get(taskId);
    if (controller) controller.abort();
    const task = this.store.get(taskId);
    if (!task) return undefined;
    if (task.status === 'pending' || task.status === 'paused' || task.status === 'running') {
      const now = Date.now();
      task.status = 'cancelled';
      task.error = 'Task execution cancelled';
      task.updatedAt = now;
      task.completedAt = now;
      this.store.put(task);
    }
    return task;
  }

  pause(taskId: string) {
    const task = this.store.get(taskId);
    if (task && task.status === 'running') {
      task.status = 'paused';
      task.updatedAt = Date.now();
      this.store.put(task);
    }
    return task;
  }

  resume(taskId: string) {
    const task = this.store.get(taskId);
    if (task?.status === 'paused') {
      task.status = 'pending';
      task.updatedAt = Date.now();
      this.store.put(task);
    }
    return task;
  }

  getTask(taskId: string) {
    return this.store.get(taskId);
  }

  listTasks(ownerId?: string) {
    return this.store.list(ownerId);
  }
}
