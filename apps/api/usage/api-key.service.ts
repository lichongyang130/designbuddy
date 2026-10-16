import { ApiKey } from './api-key.model';

export class ApiKeyService {
  create(input: ApiKey) {
    return input;
  }

  revoke(id: string) {
    return { revoked: id };
  }
}
