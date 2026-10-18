import { Plugin } from './plugin';

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin) {
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string) {
    return this.plugins.get(name);
  }

  list() {
    return Array.from(this.plugins.values());
  }
}
