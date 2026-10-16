export interface SkillDefinition {
  id: string;
  name: string;
  category: string;
  description?: string;
}

export class SkillMarketplace {
  private skills: SkillDefinition[] = [];

  publish(skill: SkillDefinition) {
    this.skills.push(skill);
  }

  search(keyword: string) {
    return this.skills.filter(s => s.name.includes(keyword));
  }

  categories() {
    return [...new Set(this.skills.map(s => s.category))];
  }
}
