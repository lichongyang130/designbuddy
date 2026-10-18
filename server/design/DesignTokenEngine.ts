export class DesignTokenEngine {
  resolve(tokens: Record<string, string>, key: string) {
    return tokens[key] ?? null;
  }

  merge(base: Record<string, string>, override: Record<string, string>) {
    return { ...base, ...override };
  }
}
