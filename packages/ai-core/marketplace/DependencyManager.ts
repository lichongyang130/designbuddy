export class DependencyManager {
  private dependencies = new Map<string, string[]>();

  add(plugin: string, deps: string[]) {
    this.dependencies.set(plugin, deps);
  }

  get(plugin: string) {
    return this.dependencies.get(plugin) || [];
  }

  hasConflict(plugin: string, dependency: string) {
    return this.get(plugin).includes(dependency);
  }
}
