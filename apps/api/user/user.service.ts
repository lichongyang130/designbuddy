import { UserRepository, UserRecord } from './user.repository';

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  createUser(user: UserRecord): UserRecord {
    return this.repository.save(user);
  }

  getUser(id: string): UserRecord | undefined {
    return this.repository.findById(id);
  }

  getUserByEmail(email: string): UserRecord | undefined {
    return this.repository.findByEmail(email);
  }
}
