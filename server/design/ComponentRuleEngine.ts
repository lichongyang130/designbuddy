export interface ComponentRule {
  component: string;
  rules: string[];
}

export class ComponentRuleEngine {
  private rules: ComponentRule[] = [];

  add(rule: ComponentRule) {
    this.rules.push(rule);
  }

  find(component: string) {
    return this.rules.filter(r => r.component === component);
  }
}
