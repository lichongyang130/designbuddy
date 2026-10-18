import { AI_PROVIDER_ENDPOINTS, AI_PROVIDER_MODELS, getAiUsageRecorder } from "./ai";
import { normalizeOpenAICompatibleBaseUrl, type ResolveModelHost } from "./openai-compatible-endpoint";
import { mapModelOptions, providerForBaseUrl, readUsage, type PlatformModelOptions, type UsageRecord } from "./model-registry";

export interface TaskChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  provider?: string;
  apiKey?: string;
  /** User-defined HTTPS endpoint for the OpenAI-compatible custom provider. */
  baseUrl?: string;
  /** The account the call belongs to; used for the usage record. */
  userId?: string;
  /** Platform level options; they are mapped onto the provider protocol explicitly. */
  options?: PlatformModelOptions;
}

export class TaskChatValidationError extends Error {}

/** Conversational streaming endpoint; it does not generate project JSON or invent tool execution. */
export async function streamTaskChat(
  input: TaskChatRequest,
  signal: AbortSignal,
  resolveHost?: ResolveModelHost,
): Promise<Response> {
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 60) throw new TaskChatValidationError("Provide between 1 and 60 messages.");
  let bytes = 0;
  for (const message of input.messages) {
    if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string" || !message.content.trim()) throw new TaskChatValidationError("Invalid chat message.");
    bytes += new TextEncoder().encode(message.content).byteLength;
    if (bytes > 600_000) throw new TaskChatValidationError("Chat content exceeds the 600 KB limit.");
  }
  if (input.messages.at(-1)?.role !== "user") throw new TaskChatValidationError("The final chat message must be a user message.");
  if (input.model && !/^[a-zA-Z0-9._:/-]{1,160}$/.test(input.model)) throw new TaskChatValidationError("Invalid model identifier.");
  const byok = !!input.apiKey;
  const customProvider = input.provider === "custom";
  if (byok && (
    input.apiKey!.length > 512 ||
    !input.apiKey!.trim() ||
    !input.provider ||
    (!customProvider && !Object.hasOwn(AI_PROVIDER_ENDPOINTS, input.provider))
  )) throw new TaskChatValidationError("Choose a supported provider and valid API key.");
  if (byok && customProvider && !input.model) throw new TaskChatValidationError("Custom providers require an explicit model identifier.");
  const apiKey = input.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "sk-5rg5xG9wpRJ9BopWlq37K46Thw0Kiah0zrBbhgDJLNN4LFzu";
  if (!apiKey) throw new Error("AI 服务尚未配置，请在服务端设置 AI_API_KEY，或在 AI 服务设置中选择服务商。");
  const base = (byok
    ? customProvider
      ? await normalizeOpenAICompatibleBaseUrl(input.baseUrl, resolveHost)
      : AI_PROVIDER_ENDPOINTS[input.provider!]
    : process.env.AI_BASE_URL || "https://apihub.agnes-ai.com/v1").replace(/\/+$/, "");
  const model = input.model || (byok ? AI_PROVIDER_MODELS[input.provider!] : process.env.AI_MODEL || process.env.OPENAI_MODEL || "agnes-3.0-flash");
  const provider = byok ? String(input.provider) : providerForBaseUrl(base);
  const options = mapModelOptions({ temperature: 0.4, ...(input.options || {}) });
  const startedAt = Date.now();
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ model, stream: true, stream_options: { include_usage: true }, ...options.body, messages: [
      { role: "system", content: "You are DesignBuddy, a helpful AI assistant. Respond in the user's language using readable Markdown. Answer the actual question instead of producing a web page unless requested. Only use context explicitly present in this conversation; do not invent memories, personal details, completed tool calls, files, or external access. You have no external tools in this chat. Provide the answer and, where useful, a concise explanation, not private internal reasoning. If an expert or skill is selected, use it as task guidance without claiming that external integrations are available. When essential missing information would materially change the result, ask for clarification instead of guessing or executing. Do not ask unnecessary questions or repeat questions already answered. To request clarification, your ENTIRE reply must be exactly one fenced block tagged designbuddy-clarification, with a JSON object containing questions: an array of 1 to 4 objects, each with id (unique ASCII letters/digits/underscore/hyphen, at most 64 chars), title (a concise question in the user language, at most 200 chars), and options (2 to 4 distinct nonempty strings, at most 160 chars each). Example: \n```designbuddy-clarification\n{\"questions\":[{\"id\":\"audience\",\"title\":\"这份报告主要给谁看？\",\"options\":[\"管理层\",\"执行团队\",\"外部客户\"]}]}\n```\nThe UI supplies a custom text answer for every question. Never use this block for examples, ordinary code, authorization, or instructions to perform external actions. The UI will pause and return the user answers in the next turn. Once answered, proceed using all confirmed details; users may choose to discuss requirements rather than create files." },
      ...input.messages.map(({ role, content }) => ({ role, content })),
    ] }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`AI 服务请求失败（HTTP ${response.status}），请检查服务配置或稍后重试。`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!response.body || !contentType.includes("text/event-stream")) {
    await response.body?.cancel();
    throw new Error("AI 服务未返回有效的流式回复，请选择支持流式对话的模型。");
  }
  return new Response(withUsageAccounting(response.body, { model, provider, startedAt, userId: input.userId }), { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff" } });
}

/**
 * Read the usage block the provider appends to the last stream chunk and record
 * it against the account that made the call. When the provider reports nothing,
 * the call is recorded as "no usage reported" instead of an estimated number.
 */
export function withUsageAccounting(
  body: ReadableStream<Uint8Array>,
  context: { model: string; provider: string; startedAt: number; userId?: string },
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let pending = "";
  let recorded = false;
  const record = (usage: ReturnType<typeof readUsage>, status: "succeeded" | "failed", error = "") => {
    if (recorded) return;
    recorded = true;
    if (!context.userId) return;
    const entry: UsageRecord = {
      model: context.model,
      provider: context.provider,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      reported: usage.reported,
      latencyMs: Date.now() - context.startedAt,
      status,
      error,
      createdAt: Date.now(),
    };
    try {
      // The recorder is registered by the daemon; a missing recorder is not an error.
      getAiUsageRecorder()?.(context.userId, entry);
    } catch { /* accounting must never break the stream */ }
  };
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        if (recorded) return;
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as { usage?: unknown };
            if (!parsed.usage) continue;
            record(readUsage(parsed), "succeeded");
          } catch { /* partial JSON is ignored */ }
        }
      },
      flush() {
        if (!recorded) record(readUsage(null), "succeeded", "服务商没有回报用量数据。");
      },
    }),
  );
}
