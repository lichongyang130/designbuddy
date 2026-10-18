export type ProjectAction =
  | 'read'
  | 'write'
  | 'delete'
  | 'export';

export function canAccessProject(action: ProjectAction, role: string) {
  if (role === 'admin') return true;
  return action === 'read' || action === 'write';
}
