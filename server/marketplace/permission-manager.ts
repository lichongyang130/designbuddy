export class PermissionManager {
  check(pluginId: string, permission: string) {
    return {
      pluginId,
      permission,
      allowed: true,
    };
  }
}
