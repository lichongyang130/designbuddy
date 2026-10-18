import { useState, type FormEvent } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AIChatPanelProps {
  messages: ChatMessage[];
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onSend(message: string): void | Promise<void>;
}

export function AIChatPanel({ messages, busy = false, disabled = false, placeholder = "描述你想要的修改…", onSend }: AIChatPanelProps) {
  const [draft, setDraft] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy || disabled) return;
    setDraft("");
    void onSend(message);
  };

  return (
    <section className="workspace-chat" aria-label="AI 对话">
      <div className="workspace-chat-messages" aria-live="polite">
        {messages.length === 0 ? <p className="workspace-chat-empty">描述你希望完成的任务。</p> : messages.map((message) => (
          <article className={`workspace-chat-message is-${message.role}`} key={message.id}>
            <strong>{message.role === "user" ? "你" : "AI 助手"}</strong>
            <p>{message.content}</p>
          </article>
        ))}
        {busy && <p role="status" className="workspace-chat-loading">正在处理…</p>}
      </div>
      <form className="workspace-chat-composer" onSubmit={submit}>
        <textarea value={draft} onChange={(event) => setDraft(event.currentTarget.value)} placeholder={placeholder} rows={4} disabled={disabled || busy} />
        <button type="submit" disabled={!draft.trim() || disabled || busy}>{busy ? "处理中…" : "发送"}</button>
        {disabled && <small>当前策略已禁用在线 AI 生成。</small>}
      </form>
    </section>
  );
}
