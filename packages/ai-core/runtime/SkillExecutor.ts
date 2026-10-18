export interface SkillCall {
  skillId: string;
  input: unknown;
}

export class SkillExecutor {
  private skills = new Map<string, Function>();

  register(skillId: string, executor: Function) {
    this.skills.set(skillId, executor);
  }

  async execute(call: SkillCall) {
    const skill = this.skills.get(call.skillId);
    if (!skill) throw new Error(`Skill ${call.skillId} not found`);
    return skill(call.input);
  }
}
