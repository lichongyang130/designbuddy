export interface PreviewBuildResult {
  success: boolean;
  previewUrl?: string;
  error?: string;
}

export type PreviewBuildRunner = (projectPath: string) => Promise<{ previewUrl: string }>;

export class PreviewBuilder {
  constructor(private readonly runner?: PreviewBuildRunner) {}

  async build(projectPath: string): Promise<PreviewBuildResult> {
    if (!projectPath.trim()) return { success: false, error: 'Project path is required' };
    if (!this.runner) {
      return {
        success: false,
        error: 'Preview build runtime is not configured. Supply a PreviewBuildRunner before requesting a preview.',
      };
    }
    try {
      const result = await this.runner(projectPath);
      if (!result.previewUrl || !/^https?:\/\//i.test(result.previewUrl)) {
        return { success: false, error: 'Preview runtime returned an invalid preview URL' };
      }
      return { success: true, previewUrl: result.previewUrl };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Preview build failed' };
    }
  }
}
