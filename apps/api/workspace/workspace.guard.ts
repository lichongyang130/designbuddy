export function workspaceGuard(
  role: string,
  permission: string,
) {
  if (!role) return false;
  if (permission === 'workspace:manage-members') {
    return role === 'owner' || role === 'admin';
  }
  return true;
}
