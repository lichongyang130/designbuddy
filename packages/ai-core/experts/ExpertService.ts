import { Expert, ExpertRegistry } from './Expert';

export class ExpertService {
  private registry: ExpertRegistry;

  constructor(registry = new ExpertRegistry()) {
    this.registry = registry;
  }

  create(expert: Expert) {
    this.registry.register(expert);
    return expert;
  }

  get(id: string) {
    return this.registry.get(id);
  }

  list() {
    return this.registry.list();
  }

  attachSkill(expertId: string, skillId: string) {
    const expert = this.registry.get(expertId);
    if (!expert) {
      throw new Error(`Expert ${expertId} not found`);
    }

    if (!expert.skills.includes(skillId)) {
      expert.skills.push(skillId);
    }

    return expert;
  }
}
