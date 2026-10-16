export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  status: 'installed' | 'disabled' | 'removed';
}

export class PluginRegistry {
  private plugins = new Map<string, PluginMetadata>();

  register(plugin: PluginMetadata) {
    this.plugins.set(plugin.id, plugin);
  }

  get(id: string) {
    return this.plugins.get(id);
  }

  list() {
    return Array.from(this.plugins.values());
  }

  updateStatus(id: string, status: PluginMetadata['status']) {
    const plugin = this.plugins.get(id);
    if (plugin) plugin.status = status;
  }
}
