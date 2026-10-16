export interface InstallRequest {
  projectPath: string;
  packages: string[];
}

export class DependencyInstaller {
  async install(request: InstallRequest) {
    return {
      installed: request.packages,
      path: request.projectPath
    };
  }
}
