export class DeploymentManager {
  deploy(name: string) { return { name, state: 'deployed' }; }
  remove(name: string) { return name; }
}
