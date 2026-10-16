import { AuthService } from './auth.service';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async login(body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  async logout(userId: string) {
    await this.authService.logout(userId);
    return { success: true };
  }
}
