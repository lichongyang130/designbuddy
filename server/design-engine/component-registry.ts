import { DesignComponent } from './component-parser';

export class ComponentRegistry {
  private components = new Map<string, DesignComponent>();

  register(component: DesignComponent) {
    this.components.set(component.id, component);
  }

  get(id: string) {
    return this.components.get(id);
  }
}
