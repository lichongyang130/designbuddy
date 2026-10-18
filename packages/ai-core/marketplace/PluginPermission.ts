export class PluginPermission {
  private permissions = new Map<string, string[]>();

  grant(plugin: string, permissions: string[]) {
    this.permissions.set(plugin, permissions);
  }

  check(plugin: string, permission: string) {
    return this.permissions.get(plugin)?.includes(permission) ?? false;
  }
}
