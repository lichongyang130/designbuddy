export class RolePermissionCenter {
  private roles = new Map<string, string[]>();
  grant(role: string, permissions: string[]) { this.roles.set(role, permissions); }
  has(role: string, permission: string) { return this.roles.get(role)?.includes(permission) ?? false; }
}
