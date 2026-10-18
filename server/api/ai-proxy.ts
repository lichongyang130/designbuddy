import { AI_PROVIDER_ENDPOINTS } from "./ai";

export interface BYOKMessage { role: "system" | "user" | "assistant"; content: string; }

export async function proxyAIStream(provider: string, apiKey: string, model: string, messages: BYOKMessage[]): Promise<Response> {
  const baseUrl = AI_PROVIDER_ENDPOINTS[provider];
  if (!baseUrl) throw new Error("Unsupported BYOK provider.");
  if (!apiKey.trim() || apiKey.length > 512) throw new Error("A valid provider API key is required.");
  if (!/^[a-zA-Z0-9._:/-]{1,160}$/.test(model)) throw new Error("Invalid model identifier.");
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 64) throw new Error("Provide between 1 and 64 chat messages.");
  let total = 0;
  for (const message of messages) {
    if (!message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string" || !message.content.trim()) throw new Error("Each message needs a supported role and text content.");
    total += new TextEncoder().encode(message.content).byteLength;
    if (total > 1_500_000) throw new Error("Chat content exceeds the 1.5 MB limit.");
  }
  const upstream = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 1_000);
    return new Response(JSON.stringify({ error: detail || `Provider returned HTTP ${upstream.status}.` }), { status: upstream.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (!upstream.body) throw new Error("Provider did not return a response stream.");
  return new Response(upstream.body, { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
