export type WorkspacePermission =
  | 'workspace:read'
  | 'workspace:write'
  | 'workspace:manage-members'
  | 'workspace:export';

export function canManageWorkspace(role: string) {
  return role === 'owner' || role === 'admin';
}
