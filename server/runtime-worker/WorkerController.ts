import { BuildExecutor } from './BuildExecutor';

export class WorkerController {
  constructor(private buildExecutor = new BuildExecutor()) {}

  async runBuild(projectPath: string) {
    return this.buildExecutor.execute({
      projectPath,
      command: 'npm run build'
    });
  }
}
