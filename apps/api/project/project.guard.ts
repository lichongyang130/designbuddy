import { canAccessProject, ProjectAction } from './project.permission';

export function projectGuard(action: ProjectAction, role: string) {
  return canAccessProject(action, role);
}
