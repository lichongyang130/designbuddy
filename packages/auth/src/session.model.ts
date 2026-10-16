export interface AuthSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export function isSessionExpired(session: AuthSession): boolean {
  return Date.now() >= session.expiresAt.getTime();
}
