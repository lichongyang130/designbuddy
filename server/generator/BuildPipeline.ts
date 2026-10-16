export interface BuildResult {
  success: boolean;
  logs: string[];
}

export class BuildPipeline {
  async execute(projectPath: string): Promise<BuildResult> {
    return {
      success: true,
      logs: [`Build started: ${projectPath}`]
    };
  }
}
