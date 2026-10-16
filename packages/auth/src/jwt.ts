import type { TokenPayload } from './types';

export interface JwtSigner {
  sign(payload: TokenPayload): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
}

export class JwtService {
  constructor(private readonly signer: JwtSigner) {}

  createAccessToken(payload: TokenPayload) {
    return this.signer.sign(payload);
  }

  validateAccessToken(token: string) {
    return this.signer.verify(token);
  }
}
