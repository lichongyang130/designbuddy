import { Skill, SkillRegistry } from './Skill';

export class SkillService {
  private registry: SkillRegistry;

  constructor(registry = new SkillRegistry()) {
    this.registry = registry;
  }

  register(skill: Skill) {
    this.registry.register(skill);
    return skill;
  }

  get(id: string) {
    return this.registry.get(id);
  }

  list() {
    return this.registry.list();
  }

  async execute(id: string, input: unknown) {
    const skill = this.registry.get(id);

    if (!skill) {
      throw new Error(`Skill ${id} not found`);
    }

    return skill.execute(input);
  }
}
