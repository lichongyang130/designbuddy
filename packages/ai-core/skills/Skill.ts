export interface Skill {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute(input: unknown): Promise<unknown>;
}

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill) {
    this.skills.set(skill.id, skill);
  }

  get(id: string) {
    return this.skills.get(id);
  }

  list() {
    return Array.from(this.skills.values());
  }
}
