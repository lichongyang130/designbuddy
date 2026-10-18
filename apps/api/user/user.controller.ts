import { UserService } from './user.service';

export class UserController {
  constructor(private readonly service: UserService) {}

  profile(userId: string) {
    return this.service.getUser(userId);
  }
}
