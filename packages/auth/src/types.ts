export interface UserIdentity {
  id: string;
  email: string;
  roles: string[];
}

export interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
