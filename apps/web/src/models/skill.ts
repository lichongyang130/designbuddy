export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  enabled: boolean;
  createdAt?: string;
}

export type CreateSkillInput = Omit<Skill, "id" | "createdAt">;
