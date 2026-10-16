export interface Project {
  id: string;
  name: string;
  ownerId: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createProject(name: string, ownerId: string): Project {
  return {
    id: crypto.randomUUID(),
    name,
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
