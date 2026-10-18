export interface Project {
  id: string;
  userId: string;
  name: string;
  content?: string;
}

const projects: Project[] = [];

export async function createProject(project: Project) {
  projects.push(project);
  return project;
}

export async function getProject(id: string) {
  return projects.find((item) => item.id === id) ?? null;
}

export async function updateProject(id: string, data: Partial<Project>) {
  const project = projects.find((item) => item.id === id);
  if (!project) return null;
  Object.assign(project, data);
  return project;
}

export async function deleteProject(id: string) {
  const index = projects.findIndex((item) => item.id === id);
  if (index < 0) return false;
  projects.splice(index, 1);
  return true;
}
