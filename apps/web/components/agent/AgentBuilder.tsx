import { FormEvent, useState } from 'react';

export interface AgentDraft {
  name: string;
  description: string;
  instructions: string;
}

export interface AgentBuilderProps {
  initialValue?: Partial<AgentDraft>;
  saving?: boolean;
  onSave?: (draft: AgentDraft) => void | Promise<void>;
}

export default function AgentBuilder({ initialValue, saving = false, onSave }: AgentBuilderProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [instructions, setInstructions] = useState(initialValue?.instructions ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setError('请输入 Agent 名称。'); return; }
    if (!instructions.trim()) { setError('请填写 Agent 指令。'); return; }
    if (!onSave) { setError('保存接口尚未连接。请接入 onSave 后再创建 Agent。'); return; }
    setError('');
    setSaved(false);
    try {
      await onSave({ name: name.trim(), description: description.trim(), instructions: instructions.trim() });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存 Agent 失败。');
    }
  }

  return (
    <form className="agent-builder" onSubmit={submit}>
      <h2>创建 Agent</h2>
      <label htmlFor="agent-name">名称</label>
      <input id="agent-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
      <label htmlFor="agent-description">描述</label>
      <textarea id="agent-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={2000} />
      <label htmlFor="agent-instructions">系统指令</label>
      <textarea id="agent-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={8} maxLength={20000} required placeholder="定义 Agent 的职责、行为和约束…" />
      <button type="submit" disabled={saving}>{saving ? '保存中…' : '保存 Agent'}</button>
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Agent 已保存。</p>}
    </form>
  );
}
