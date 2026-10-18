export type GenerationStepStatus = "waiting" | "active" | "complete" | "error";

export interface GenerationStep {
  id: string;
  name: string;
  status: GenerationStepStatus;
  detail?: string;
}

export function GenerationTimeline({ steps }: { steps: GenerationStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="workspace-generation-timeline" aria-label="生成进度" aria-live="polite">
      {steps.map((step) => <li key={step.id} className={`is-${step.status}`}>
        <span className="workspace-generation-marker" aria-hidden="true">{step.status === "complete" ? "✓" : step.status === "error" ? "!" : step.status === "active" ? "…" : "·"}</span>
        <span><strong>{step.name}</strong>{step.detail && <small>{step.detail}</small>}</span>
      </li>)}
    </ol>
  );
}
