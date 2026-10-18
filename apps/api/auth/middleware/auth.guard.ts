import { JwtService } from '../../../../packages/auth/src/jwt';

export class AuthGuard {
  constructor(private readonly jwtService: JwtService) {}

  verifyAuthorizationHeader(header?: string) {
    if (!header || !header.startsWith('Bearer ')) {
      throw new Error('Missing authorization token');
    }

    const token = header.replace('Bearer ', '');
    return this.jwtService.validateAccessToken(token);
  }
}
