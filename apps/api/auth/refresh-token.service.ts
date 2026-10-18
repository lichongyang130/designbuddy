export interface RefreshTokenRecord {
  token: string;
  userId: string;
  expiresAt: Date;
  revoked: boolean;
}

export class RefreshTokenService {
  private tokens = new Map<string, RefreshTokenRecord>();

  create(userId: string, token: string, expiresAt: Date): RefreshTokenRecord {
    const record: RefreshTokenRecord = { token, userId, expiresAt, revoked: false };
    this.tokens.set(token, record);
    return record;
  }

  get(token: string): RefreshTokenRecord | undefined {
    return this.tokens.get(token);
  }

  rotate(token: string, nextToken: string, expiresAt: Date): RefreshTokenRecord {
    const current = this.tokens.get(token);
    if (!current || current.revoked || current.expiresAt <= new Date()) {
      throw new Error('Invalid refresh token');
    }
    current.revoked = true;
    return this.create(current.userId, nextToken, expiresAt);
  }

  revoke(token: string): void {
    const current = this.tokens.get(token);
    if (current) current.revoked = true;
  }

  validate(token: string): boolean {
    const current = this.tokens.get(token);
    return Boolean(current && !current.revoked && current.expiresAt > new Date());
  }
}
