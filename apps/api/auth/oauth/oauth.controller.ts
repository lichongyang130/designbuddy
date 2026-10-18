import { OAuthProvider } from './oauth.provider';

export class OAuthController {
  constructor(private provider: OAuthProvider) {}

  async login(code: string) {
    const profile = await this.provider.authenticate(code);

    return {
      provider: profile.provider,
      userId: profile.providerUserId,
    };
  }
}
