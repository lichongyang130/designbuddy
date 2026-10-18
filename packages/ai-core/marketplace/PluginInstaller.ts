export class PluginInstaller {
  private installed = new Set<string>();

  install(pluginId: string) {
    this.installed.add(pluginId);
    return true;
  }

  uninstall(pluginId: string) {
    this.installed.delete(pluginId);
    return true;
  }

  rollback(pluginId: string) {
    return this.uninstall(pluginId);
  }

  isInstalled(pluginId: string) {
    return this.installed.has(pluginId);
  }
}
