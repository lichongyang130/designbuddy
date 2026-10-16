export interface DesignSystem {
  id: string;
  name: string;
  description?: string;
  tokens?: Record<string, string>;
}

export class DesignSystemRegistry {
  private systems = new Map<string, DesignSystem>();

  register(system: DesignSystem) {
    this.systems.set(system.id, system);
  }

  get(id: string) {
    return this.systems.get(id);
  }

  list() {
    return Array.from(this.systems.values());
  }
}
