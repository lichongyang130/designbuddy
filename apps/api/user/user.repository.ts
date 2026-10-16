export interface UserRecord {
  id: string;
  email: string;
  displayName?: string;
  passwordHash?: string;
  roles: string[];
}

export class UserRepository {
  private users = new Map<string, UserRecord>();

  save(user: UserRecord): UserRecord {
    this.users.set(user.id, user);
    return user;
  }

  findById(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  findByEmail(email: string): UserRecord | undefined {
    return [...this.users.values()].find((user) => user.email === email);
  }
}
