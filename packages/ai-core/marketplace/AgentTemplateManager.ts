export interface AgentTemplate {
  id: string;
  name: string;
  version: string;
  config: Record<string, unknown>;
}

export class AgentTemplateManager {
  private templates = new Map<string, AgentTemplate>();

  create(template: AgentTemplate) {
    this.templates.set(template.id, template);
  }

  get(id: string) {
    return this.templates.get(id);
  }

  versions(id: string) {
    const template = this.templates.get(id);
    return template ? [template.version] : [];
  }
}
