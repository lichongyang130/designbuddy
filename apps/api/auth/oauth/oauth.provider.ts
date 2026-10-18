export interface OAuthProfile {
  provider: string;
  providerUserId: string;
  email?: string;
  name?: string;
}

export interface OAuthProvider {
  name(): string;
  authenticate(code: string): Promise<OAuthProfile>;
}
