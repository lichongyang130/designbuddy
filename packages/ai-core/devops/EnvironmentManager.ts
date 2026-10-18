export class EnvironmentManager {
  private environments = new Map<string, string>();
  set(name: string, value: string) { this.environments.set(name, value); }
  get(name: string) { return this.environments.get(name); }
}
