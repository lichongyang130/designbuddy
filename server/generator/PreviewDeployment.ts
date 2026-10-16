export interface PreviewDeployment {
  url: string;
  status: 'pending' | 'ready' | 'failed';
}

export type PreviewDeployer = (projectId: string) => Promise<PreviewDeployment>;

export class PreviewDeploymentService {
  constructor(private readonly deployer?: PreviewDeployer) {}

  async deploy(projectId: string): Promise<PreviewDeployment> {
    if (!projectId.trim()) throw new Error('Project id is required');
    if (!this.deployer) {
      return {
        url: '',
        status: 'failed',
      };
    }
    const deployment = await this.deployer(projectId);
    if (deployment.status === 'ready' && !/^https?:\/\//i.test(deployment.url)) {
      throw new Error('Deployment adapter reported ready without a valid HTTP(S) URL');
    }
    return deployment;
  }
}
