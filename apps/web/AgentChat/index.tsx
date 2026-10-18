import { FormEvent, useState } from 'react';

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentChatProps {
  messages?: AgentChatMessage[];
  loading?: boolean;
  error?: string;
  onSend?: (message: string) => void | Promise<void>;
}

export default function AgentChat({ messages = [], loading = false, error, onSend }: AgentChatProps) {
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<AgentChatMessage[]>([]);
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || loading) return;
    setNotice('');
    if (!onSend) {
      setNotice('聊天后端尚未连接。请通过 onSend 接入实际 Agent API 后再发送消息。');
      return;
    }
    setDraft('');
    setLocalMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content }]);
    try {
      await onSend(content);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '消息发送失败，请重试。');
    }
  }

  const visibleMessages = messages.length ? messages : localMessages;

  return (
    <section className="agent-chat" aria-label="Agent Chat">
      <header><h2>Agent Chat</h2><p>与 AI Agent 交流并描述你的任务。</p></header>
      <div className="agent-chat__messages" aria-live="polite" aria-relevant="additions">
        {visibleMessages.length === 0 && <p>还没有消息。输入任务描述开始。</p>}
        {visibleMessages.map((message) => (
          <article key={message.id} className={`agent-chat__message agent-chat__message--${message.role}`}>
            <strong>{message.role === 'user' ? '你' : 'Agent'}</strong>
            <p>{message.content}</p>
          </article>
        ))}
        {loading && <p role="status">Agent 正在处理…</p>}
      </div>
      <form onSubmit={submit}>
        <label htmlFor="agent-chat-input">任务消息</label>
        <textarea id="agent-chat-input" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={12000} placeholder="描述你希望 Agent 完成的任务…" />
        <button type="submit" disabled={!draft.trim() || loading}>发送</button>
      </form>
      {(error || notice) && <p role="alert">{error || notice}</p>}
    </section>
  );
}
