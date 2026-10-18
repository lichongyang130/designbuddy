export interface UserPresence {
  userId: string;
  status: 'online' | 'offline';
  cursor?: { x: number; y: number };
}

export class PresenceManager {
  private users: UserPresence[] = [];

  update(user: UserPresence) {
    this.users = [
      ...this.users.filter(item => item.userId !== user.userId),
      user
    ];
  }

  list() {
    return this.users;
  }
}
