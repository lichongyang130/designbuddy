export interface ExecutionRequest {
  command: string;
  cwd?: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
}

export class SandboxExecutor {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    return {
      success: true,
      output: `sandbox:${request.command}`
    };
  }
}
