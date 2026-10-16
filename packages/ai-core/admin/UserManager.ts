export class UserManager {
  private users = new Map<string, unknown>();
  create(id: string, user: unknown) { this.users.set(id, user); }
  get(id: string) { return this.users.get(id); }
}
