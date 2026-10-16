import { useId, useRef, useEffect } from "react";
import { HomeIcon } from "../../apps/web/src/components/HomeIcon";
import { answerComplete, type TaskClarification } from "./taskClarification";
import "./task-clarification.css";

export function TaskClarificationCard({ value, onChange, onSubmit, onClose }: {
  value: TaskClarification;
  onChange: (value: TaskClarification) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const q = value.questions[value.page];
  const answer = value.answers[value.page];
  const remaining = value.questions.filter((_, i) => !answerComplete(value, i)).length;
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [value.page]);
  const changeAnswer = (changes: Partial<typeof answer>) => onChange({ ...value, answers: value.answers.map((a, i) => i === value.page ? { ...a, ...changes } : a) });
  return <section className="task-clarification-card" aria-label="确认问题">
    <header className="clarification-header">
      <h2 id={titleId} ref={title} tabIndex={-1}>{q.title}</h2>
      <nav aria-label="问题翻页">
        <button type="button" aria-label="上一题" disabled={value.page === 0} onClick={() => onChange({ ...value, page: value.page - 1 })}><HomeIcon name="chevron" size={13} /></button>
        <span aria-live="polite" aria-label={`第 ${value.page + 1} 题，共 ${value.questions.length} 题`}>{value.page + 1}/{value.questions.length}</span>
        <button type="button" aria-label="下一题" disabled={value.page === value.questions.length - 1} onClick={() => onChange({ ...value, page: value.page + 1 })}><HomeIcon name="chevron" size={13} /></button>
        <button type="button" aria-label="关闭确认" className="clarification-close" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </nav>
    </header>
    <div className="clarification-options" role="radiogroup" aria-labelledby={titleId} onKeyDown={(event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const n = q.options.length;
      const index = event.key === "Home" ? 0 : event.key === "End" ? n - 1 : ((answer.option ?? 0) + (event.key === "ArrowDown" ? 1 : -1) + n) % n;
      changeAnswer({ option: index });
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[index]?.focus();
    }}>
      {q.options.map((option, i) => <button type="button" key={`${q.id}-${i}`} role="radio" aria-checked={answer.option === i} tabIndex={i === (answer.option ?? 0) ? 0 : -1} className="clarification-option" onClick={() => changeAnswer({ option: i })}>
        <span className="clarification-number" aria-hidden="true">{i + 1}</span><span className="clarification-option-text">{option}</span>
        <svg className="clarification-option-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
      </button>)}
    </div>
    {value.kind === "requirements" && <label className="clarification-note"><span className="clarification-number"><HomeIcon name="pencil" size={15} /></span><input key={q.id} aria-label="其他补充" placeholder="其他补充…" maxLength={2000} value={answer.note} onChange={(event) => changeAnswer({ note: event.target.value })} /></label>}
    <footer className="clarification-footer"><span aria-live="polite">{remaining ? `还有 ${remaining} 项待确认` : ""}</span><button type="button" className="task-send" aria-label="提交确认并继续" title={remaining ? "请先回答全部问题，也可以填写其他补充" : "提交确认并继续"} disabled={remaining > 0} onClick={onSubmit}><HomeIcon name="send" size={19} /></button></footer>
  </section>;
}
