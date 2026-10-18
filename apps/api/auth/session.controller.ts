import { SessionService } from './session.service';

export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  getSessions(userId: string) {
    return this.sessionService.listByUser(userId);
  }

  logout(sessionId: string) {
    this.sessionService.revoke(sessionId);

    return {
      success: true,
    };
  }
}
