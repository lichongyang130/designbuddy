import { ModelRouter, RouteRequest } from '../providers/ModelRouter';
import { ChatMessage, ModelCapability, ModelResponse, ProviderError, ProviderId } from '../providers/ModelProvider';

export type AgentTaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';
export interface AgentTask {
  id: string;
  input: unknown;
  status: AgentTaskStatus;
  provider?: ProviderId;
  model?: string;
  requiredCapabilities?: ModelCapability[];
  result?: string;
  error?: string;
  createdAt?: number;
  startedAt?: number;
  completedAt?: number;
  execution?: AgentExecutionRecord[];
}
export interface AgentExecutionRecord {
  startedAt: number;
  completedAt: number;
  status: 'succeeded' | 'failed';
  provider?: ProviderId;
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  usageEstimated?: boolean;
  error?: { name: string; message: string; provider?: ProviderId; status?: number; retryable?: boolean };
}
export interface AgentRuntimeOptions {
  modelRouter?: ModelRouter;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}
function inputToMessages(input: unknown, systemPrompt?: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  if (typeof input === 'string') messages.push({ role: 'user', content: input });
  else if (input && typeof input === 'object' && 'messages' in input && Array.isArray((input as {messages: unknown}).messages)) {
    for (const item of (input as {messages: unknown[]}).messages) {
      if (item && typeof item === 'object' && 'role' in item && 'content' in item) {
        const message = item as {role: unknown; content: unknown};
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
  private tasks = new Map<string, AgentTask>();
  private readonly modelRouter?: ModelRouter;
  private readonly options: AgentRuntimeOptions;

  constructor(options: AgentRuntimeOptions = {}) {
    this.options = options;
    this.modelRouter = options.modelRouter;
  }

  createTask(task: AgentTask) {
    if (!task.id) throw new Error('Task id is required');
    const normalized: AgentTask = {
      ...task, status: task.status ?? 'pending', createdAt: task.createdAt ?? Date.now(),
      execution: task.execution ?? [],
    };
    this.tasks.set(task.id, normalized);
    return normalized;
  }

  async run(taskId: string): Promise<AgentTask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    if (!this.modelRouter) {
      task.status = 'failed';
      task.error = 'ModelRouter is not configured';
      throw new Error(task.error);
    }
    if (task.status === 'paused') throw new Error('Task is paused; call resume before running it');
    task.status = 'running';
    task.startedAt ??= Date.now();
    task.error = undefined;
    const startedAt = Date.now();
    let response: ModelResponse | undefined;
    try {
      const route: RouteRequest = {
        messages: inputToMessages(task.input, this.options.systemPrompt),
        provider: task.provider,
        preferredModel: task.model,
        requiredCapabilities: task.requiredCapabilities ?? ['chat'],
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
      };
      response = await this.modelRouter.complete(route);
      const finishedAt = Date.now();
      task.result = response.content;
      task.provider = response.provider;
      task.model = response.model;
      task.status = 'completed';
      task.completedAt = finishedAt;
      task.execution!.push({
        startedAt, completedAt: finishedAt, status: 'succeeded',
        provider: response.provider, model: response.model, latencyMs: response.latencyMs,
        inputTokens: response.usage.inputTokens, outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens, usageEstimated: response.usage.estimated,
      });
      return task;
    } catch (error) {
      const finishedAt = Date.now();
      const providerError = error instanceof ProviderError ? error : undefined;
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown agent execution error';
      task.execution!.push({
        startedAt, completedAt: finishedAt, status: 'failed', latencyMs: finishedAt - startedAt,
        error: {
          name: error instanceof Error ? error.name : 'UnknownError',
          message: task.error, provider: providerError?.provider,
          status: providerError?.status, retryable: providerError?.retryable,
        },
      });
      throw error;
    }
  }

  pause(taskId: string) {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'running') task.status = 'paused';
    return task;
  }

  resume(taskId: string) {
    const task = this.tasks.get(taskId);
    if (task?.status === 'paused') task.status = 'pending';
    return task;
  }

  getTask(taskId: string) { return this.tasks.get(taskId); }
  listTasks() { return Array.from(this.tasks.values()); }
}
