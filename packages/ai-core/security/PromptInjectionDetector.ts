export class PromptInjectionDetector {
  detect(prompt: string) { return /ignore previous|system prompt/i.test(prompt); }
}
