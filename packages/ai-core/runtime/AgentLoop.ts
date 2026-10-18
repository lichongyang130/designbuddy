export interface AgentLoopOptions {
  maxIterations?: number;
  timeoutMs?: number;
}

export interface ToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutor {
  execute(request: ToolRequest): Promise<unknown>;
}

export class AgentLoop {
  private maxIterations: number;
  private timeoutMs: number;

  constructor(private toolExecutor: ToolExecutor, options: AgentLoopOptions = {}) {
    this.maxIterations = options.maxIterations ?? 10;
    this.timeoutMs = options.timeoutMs ?? 120000;
  }

  async run(initialInput: unknown, model: (input: unknown) => Promise<any>) {
    const started = Date.now();
    let input = initialInput;

    for (let i = 0; i < this.maxIterations; i++) {
      if (Date.now() - started > this.timeoutMs) {
        throw new Error('Agent execution timeout');
      }

      const response = await model(input);
      if (!response.toolCall) return response;

      const result = await this.toolExecutor.execute(response.toolCall);
      input = { previous: response, toolResult: result };
    }

    throw new Error('Maximum agent iterations reached');
  }
}
