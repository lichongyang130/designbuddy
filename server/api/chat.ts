import { AI_PROVIDER_ENDPOINTS, AI_PROVIDER_MODELS } from "./ai";

export interface TaskChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  provider?: string;
  apiKey?: string;
}

export class TaskChatValidationError extends Error {}

/** Conversational streaming endpoint; it does not generate project JSON or invent tool execution. */
export async function streamTaskChat(input: TaskChatRequest, signal: AbortSignal): Promise<Response> {
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
  if (byok && (input.apiKey!.length > 512 || !input.provider || !Object.hasOwn(AI_PROVIDER_ENDPOINTS, input.provider))) throw new TaskChatValidationError("Choose a supported provider and valid API key.");
  const apiKey = input.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI 服务尚未配置，请在服务端设置 AI_API_KEY，或在 AI 服务设置中选择服务商。");
  const base = (byok ? AI_PROVIDER_ENDPOINTS[input.provider!] : process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = input.model || (byok ? AI_PROVIDER_MODELS[input.provider!] : process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ model, stream: true, messages: [
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
  return new Response(response.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff" } });
}
