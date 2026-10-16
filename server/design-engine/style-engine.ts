export class StyleEngine {
  generate(tokens: Record<string, unknown>) {
    return {
      tokens,
      css: true
    };
  }
}
