export class OrganizationManager {
  private organizations = new Map<string, unknown>();
  register(id: string, organization: unknown) { this.organizations.set(id, organization); }
  find(id: string) { return this.organizations.get(id); }
}
