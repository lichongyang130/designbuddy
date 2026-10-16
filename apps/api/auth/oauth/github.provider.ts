import { OAuthProvider, OAuthProfile } from './oauth.provider';

interface GithubOAuthOptions {
  clientId?: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
}

interface GithubUser {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
}

export class GithubOAuthProvider implements OAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GithubOAuthOptions = {}) {
    this.clientId = options.clientId ?? process.env.GITHUB_CLIENT_ID ?? '';
    this.clientSecret = options.clientSecret ?? process.env.GITHUB_CLIENT_SECRET ?? '';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  name(): string {
    return 'github';
  }

  async authenticate(code: string): Promise<OAuthProfile> {
    if (!code.trim()) throw new Error('GitHub OAuth authorization code is required');
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GitHub OAuth is not configured: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET');
    }

    const tokenResponse = await this.fetchImpl('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret, code }),
    });
    if (!tokenResponse.ok) throw new Error(`GitHub token exchange failed (HTTP ${tokenResponse.status})`);
    const tokenPayload = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };
    if (!tokenPayload.access_token) {
      throw new Error(tokenPayload.error_description || tokenPayload.error || 'GitHub did not return an access token');
    }

    const headers = {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'DesignBuddy',
    };
    const userResponse = await this.fetchImpl('https://api.github.com/user', { headers });
    if (!userResponse.ok) throw new Error(`GitHub profile lookup failed (HTTP ${userResponse.status})`);
    const user = await userResponse.json() as GithubUser;

    let email = user.email ?? undefined;
    if (!email) {
      const emailResponse = await this.fetchImpl('https://api.github.com/user/emails', { headers });
      if (emailResponse.ok) {
        const emails = await emailResponse.json() as Array<{ email: string; primary?: boolean; verified?: boolean }>;
        email = emails.find((item) => item.primary && item.verified)?.email
          ?? emails.find((item) => item.verified)?.email;
      }
    }

    return {
      provider: 'github',
      providerUserId: String(user.id),
      ...(email ? { email } : {}),
      ...(user.name || user.login ? { name: user.name || user.login } : {}),
    };
  }
}
