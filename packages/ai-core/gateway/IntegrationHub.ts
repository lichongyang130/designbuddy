export class IntegrationHub {
  private integrations = new Map<string, unknown>();
  register(name: string, adapter: unknown) { this.integrations.set(name, adapter); }
}
