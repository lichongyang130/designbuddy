export class APIKeyManager {
  generate(owner: string) { return `${owner}-${Date.now()}`; }
}
