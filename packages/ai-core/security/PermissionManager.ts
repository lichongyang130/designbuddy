export class PermissionManager {
  private permissions = new Map<string, string[]>();
  grant(agent: string, permission: string) { this.permissions.set(agent, [...(this.permissions.get(agent) || []), permission]); }
  has(agent: string, permission: string) { return (this.permissions.get(agent) || []).includes(permission); }
}
