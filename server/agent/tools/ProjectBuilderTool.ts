export interface BuildRequest {
  projectPath: string;
  command?: string;
}

export class ProjectBuilderTool {
  name = 'project_builder';

  async build(request: BuildRequest) {
    return {
      projectPath: request.projectPath,
      command: request.command ?? 'npm run build',
      status: 'started'
    };
  }
}
