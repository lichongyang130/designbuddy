import { useState } from "react";
import { HomeIcon } from "../../apps/web/src/components/HomeIcon";
import "./task-thinking-process.css";

export interface ThinkingStep {
  id: string;
  type: "thinking" | "api-call" | "skill" | "file" | "expert";
  title: string;
  detail?: string;
  status: "pending" | "running" | "complete" | "error";
  timestamp: number;
}

export function TaskThinkingProcess({ steps, isStreaming }: { steps: ThinkingStep[]; isStreaming: boolean }) {
  const [expanded, setExpanded] = useState(true);

  if (steps.length === 0) return null;

  const getIcon = (type: ThinkingStep["type"]) => {
    switch (type) {
      case "thinking": return "bulb";
      case "api-call": return "link";
      case "skill": return "bolt";
      case "file": return "document";
      case "expert": return "experts";
    }
  };

  const getStatusIcon = (status: ThinkingStep["status"]) => {
    switch (status) {
      case "pending": return <span className="thinking-status-pending">○</span>;
      case "running": return <span className="thinking-status-running">◉</span>;
      case "complete": return <HomeIcon name="check" size={14} />;
      case "error": return <span className="thinking-status-error">✕</span>;
    }
  };

  const getStatusLabel = (status: ThinkingStep["status"]) => {
    switch (status) {
      case "pending": return "等待中";
      case "running": return "执行中";
      case "complete": return "完成";
      case "error": return "失败";
    }
  };

  return (
    <div className="task-thinking-process">
      <button
        type="button"
        className="thinking-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className={expanded ? "thinking-toggle-icon is-open" : "thinking-toggle-icon"}>
          <HomeIcon name="chevron" size={12} />
        </span>
        <span>思考过程 ({steps.length} 步)</span>
        {isStreaming && <span className="thinking-streaming">进行中...</span>}
      </button>
      
      {expanded && (
        <div className="thinking-steps">
          {steps.map((step) => (
            <div key={step.id} className={`thinking-step thinking-step-${step.status}`}>
              <div className="thinking-step-header">
                <span className="thinking-step-icon">
                  <HomeIcon name={getIcon(step.type)} size={14} />
                </span>
                <span className="thinking-step-title">{step.title}</span>
                <span className="thinking-step-status">
                  {getStatusIcon(step.status)}
                  <span className="thinking-step-status-label">{getStatusLabel(step.status)}</span>
                </span>
              </div>
              {step.detail && (
                <div className="thinking-step-detail">{step.detail}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
