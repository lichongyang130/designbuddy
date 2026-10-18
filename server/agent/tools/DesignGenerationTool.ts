export interface DesignRequest {
  prompt: string;
  framework?: string;
}

export class DesignGenerationTool {
  name = 'design_generation';

  async generate(request: DesignRequest) {
    return {
      prompt: request.prompt,
      framework: request.framework ?? 'react',
      files: []
    };
  }
}
