export type Permission =
  | 'project:read'
  | 'project:write'
  | 'agent:execute'
  | 'export:create';

export function hasPermission(
  permissions: Permission[],
  required: Permission
): boolean {
  return permissions.includes(required);
}
