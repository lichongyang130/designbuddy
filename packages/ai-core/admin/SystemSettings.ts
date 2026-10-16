export class SystemSettings {
  private settings = new Map<string, unknown>();
  set(key: string, value: unknown) { this.settings.set(key, value); }
  get(key: string) { return this.settings.get(key); }
}
