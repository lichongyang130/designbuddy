export interface BuildRequest {
  projectPath: string;
  command: string;
}

export interface BuildResult {
  success: boolean;
  output: string;
}

export class BuildExecutor {
  async execute(request: BuildRequest): Promise<BuildResult> {
    return {
      success: true,
      output: `executed ${request.command}`
    };
  }
}
