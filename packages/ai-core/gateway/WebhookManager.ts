export class WebhookManager {
  emit(url: string, payload: unknown) { return { url, payload }; }
}
