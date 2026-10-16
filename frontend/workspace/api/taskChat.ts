import { apiFetch } from "../../../apps/web/src/api/client";

export interface TaskChatInput {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  provider?: string;
  apiKey?: string;
}

/** Decode real SSE content; reasoning/tool-call deltas are deliberately not shown as an answer. */
export async function streamTaskReply(input: TaskChatInput, signal: AbortSignal, onDelta: (text: string, model?: string) => void): Promise<void> {
  const response = await apiFetch("/chat", { method: "POST", signal, headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify(input) });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === "string" ? body.error : `AI 对话服务不可用（HTTP ${response.status}）。请确认后端与 AI 服务已配置。`);
  }
  if (!response.body) throw new Error("AI 服务没有返回回复内容。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  let gotContent = false;
  let length = 0;
  let doneMarker = false;
  function event(raw: string) {
    const data = raw.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) return;
    if (data.trim() === "[DONE]") { doneMarker = true; finished = true; return; }
    let payload;
    try { payload = JSON.parse(data); } catch { throw new Error("AI 回复数据损坏，请重试。"); }
    if (payload.error) throw new Error("AI 服务在回复过程中发生错误，请稍后重试。");
    const choice = payload.choices?.[0];
    const text = choice?.delta?.content;
    if (typeof text === "string" && text) {
      length += text.length;
      if (length > 300_000) throw new Error("回复超出 300,000 字符限制，已停止接收。");
      gotContent = true;
      onDelta(text, typeof payload.model === "string" ? payload.model : undefined);
    }
    if (choice?.finish_reason === "length") throw new Error("回复达到模型长度限制，已保留收到的内容，可继续追问。");
    if (choice?.finish_reason === "content_filter") throw new Error("AI 服务中止了回复，已保留收到的内容。");
    if (choice?.finish_reason === "stop") finished = true;
  }
  try {
    while (!doneMarker) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // Keep split CRLF boundaries intact until both characters arrive.
      buffer = buffer.replace(/\r\n/g, "\n");
      if (buffer.length > 600_000) throw new Error("AI 流式事件超出大小限制。");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        event(raw);
        if (doneMarker) break;
      }
      if (done) { if (buffer.trim() && !doneMarker) event(buffer); break; }
    }
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (!finished) throw new Error("连接在回复完成前中断，已保留收到的内容。");
    if (!gotContent) throw new Error("AI 服务未返回可显示的回复。");
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
