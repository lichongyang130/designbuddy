export interface ProjectFile {
  path: string;
  content: string;
  language: "html" | "css" | "javascript" | "json" | "text";
}

export interface DesignProject {
  id: string;
  name: string;
  prompt: string;
  files: ProjectFile[];
  designSystemId?: string;
  workspaceName?: string;
  executionPolicy?: string;
  createdAt: string;
  updatedAt: string;
  status: "draft";
}

export const PROJECT_STORAGE_KEY = "designbuddy.projects.v1";
