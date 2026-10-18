export interface RefreshTokenStore {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  revoke(tokenHash: string): Promise<void>;
  exists(tokenHash: string): Promise<boolean>;
}

export class MemoryRefreshTokenStore implements RefreshTokenStore {
  private tokens = new Map<string, Date>();

  async save(_userId: string, tokenHash: string, expiresAt: Date) {
    this.tokens.set(tokenHash, expiresAt);
  }

  async revoke(tokenHash: string) {
    this.tokens.delete(tokenHash);
  }

  async exists(tokenHash: string) {
    const expiresAt = this.tokens.get(tokenHash);
    return Boolean(expiresAt && expiresAt.getTime() > Date.now());
  }
}
