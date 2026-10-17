import { useCallback, useEffect, useState } from "react";
import {
  fetchWorkflowRun,
  listWorkflows,
  startWorkflow,
  workflowArtifactUrl,
  type Workflow,
  type WorkflowField,
  type WorkflowRun,
  type WorkflowStepRun,
} from "../../../../frontend/workspace/api/workflows";
import { uploadAsset } from "../../../../frontend/workspace/api/assets";
import "./workflow-modal.css";

type Answers = {
  fields: Record<string, string>;
  rows: Record<string, Record<string, string>[]>;
  files: Record<string, { assetId: string; name: string }>;
};

const EMPTY: Answers = { fields: {}, rows: {}, files: {} };

/** Plain language status for users. */
function statusLabel(status: WorkflowRun["status"]): string {
  const labels = {
    running: "正在处理…",
    succeeded: "✅ 完成",
    failed: "❌ 未完成",
    partial: "⚠️ 部分完成",
  };
  return labels[status];
}

/** Simplified step status without technical jargon. */
function stepStatusLabel(status: WorkflowStepRun["status"]): string {
  const labels = {
    pending: "等待中",
    running: "处理中",
    succeeded: "✅ 完成",
    failed: "❌ 失败",
    skipped: "已跳过",
    unavailable: "不可用",
  };
  return labels[status];
}

export function WorkflowModal({
  workflowId,
  onClose,
}: {
  workflowId: string;
  onClose(): void;
}) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await listWorkflows();
      const found = list.find((w) => w.id === workflowId);
      if (!found) {
        setError("未找到该工作流");
        return;
      }
      setWorkflow(found);
      // Initialize defaults
      const defaults: Record<string, string> = {};
      for (const field of found.fields) {
        if (field.default !== undefined) defaults[field.key] = field.default;
      }
      setAnswers({ fields: defaults, rows: {}, files: {} });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载工作流失败");
    }
  }, [workflowId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Poll until the run finishes. */
  const follow = useCallback(async (runId: string) => {
    for (let i = 0; i < 180; i++) {
      const current = await fetchWorkflowRun(runId);
      setRun(current);
      if (current.status !== "running") return current;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return null;
  }, []);

  function setField(key: string, value: string) {
    setAnswers((cur) => ({ ...cur, fields: { ...cur.fields, [key]: value } }));
  }

  function setRowValue(rowKey: string, index: number, column: string, value: string) {
    setAnswers((cur) => {
      const list = [...(cur.rows[rowKey] ?? [])];
      list[index] = { ...(list[index] ?? {}), [column]: value };
      return { ...cur, rows: { ...cur.rows, [rowKey]: list } };
    });
  }

  function addRow(field: WorkflowField) {
    setAnswers((cur) => {
      const list = [...(cur.rows[field.key] ?? [])];
      const empty: Record<string, string> = {};
      for (const col of field.columns ?? []) empty[col.key] = "";
      list.push(empty);
      return { ...cur, rows: { ...cur.rows, [field.key]: list } };
    });
  }

  function removeRow(field: WorkflowField, index: number) {
    setAnswers((cur) => {
      const list = [...(cur.rows[field.key] ?? [])];
      list.splice(index, 1);
      return { ...cur, rows: { ...cur.rows, [field.key]: list } };
    });
  }

  async function pickFile(field: WorkflowField, file: File | null) {
    if (!file) return;
    setUploading(field.key);
    try {
      const asset = await uploadAsset(file);
      setAnswers((cur) => ({
        ...cur,
        files: { ...cur.files, [field.key]: { assetId: asset.id, name: asset.name } },
      }));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文件上传失败");
    } finally {
      setUploading("");
    }
  }

  /** Check required fields before submission. */
  function validate(): string[] {
    if (!workflow) return [];
    const missing: string[] = [];
    for (const field of workflow.fields) {
      if (!field.required) continue;
      if (field.type === "rows") {
        const list = answers.rows[field.key] ?? [];
        const min = field.minRows ?? 1;
        const filled = list.filter((row) => Object.values(row).some((v) => v.trim()));
        if (filled.length < min) missing.push(field.label);
        continue;
      }
      if (field.type === "file") {
        if (!answers.files[field.key]?.assetId) missing.push(field.label);
        continue;
      }
      if (!(answers.fields[field.key] ?? "").trim()) missing.push(field.label);
    }
    return missing;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workflow || busy) return;
    const missing = validate();
    if (missing.length > 0) {
      setError(`请填写：${missing.join("、")}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const started = await startWorkflow(workflow.id, {
        fields: { ...answers.fields, ...answers.rows },
        files: answers.files,
      });
      setRun(started);
      await follow(started.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  /** Filter visible fields based on conditional logic. */
  const visibleFields = workflow?.fields.filter((field) => {
    if (!field.visibleWhen) return true;
    return (answers.fields[field.visibleWhen.field] ?? "") === field.visibleWhen.equals;
  }) ?? [];

  return (
    <div className="workflow-modal-overlay" onClick={onClose}>
      <div className="workflow-modal" onClick={(e) => e.stopPropagation()}>
        <header className="workflow-modal-header">
          <h2>{workflow?.name ?? "加载中…"}</h2>
          <button className="workflow-modal-close" type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </header>

        {!run && workflow && (
          <form className="workflow-modal-form" onSubmit={(e) => void submit(e)}>
            <p className="workflow-modal-goal">{workflow.goal}</p>
            {error && <p className="workflow-modal-error">{error}</p>}
            <div className="workflow-modal-fields">
              {visibleFields.map((field) => (
                <div key={field.key} className="workflow-modal-field">
                  <label htmlFor={`wf-${field.key}`}>
                    {field.label}
                    {field.required && <span className="workflow-modal-required">*</span>}
                  </label>
                  {field.help && <small>{field.help}</small>}
                  {field.type === "text" && (
                    <input
                      id={`wf-${field.key}`}
                      type="text"
                      value={answers.fields[field.key] ?? field.default ?? ""}
                      placeholder={field.placeholder}
                      onChange={(e) => setField(field.key, e.target.value)}
                    />
                  )}
                  {field.type === "textarea" && (
                    <textarea
                      id={`wf-${field.key}`}
                      rows={3}
                      value={answers.fields[field.key] ?? field.default ?? ""}
                      placeholder={field.placeholder}
                      onChange={(e) => setField(field.key, e.target.value)}
                    />
                  )}
                  {field.type === "choice" && (
                    <select
                      id={`wf-${field.key}`}
                      value={answers.fields[field.key] ?? field.default ?? ""}
                      onChange={(e) => setField(field.key, e.target.value)}
                    >
                      {(field.choices ?? []).map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {field.type === "file" && (
                    <div className="workflow-modal-file">
                      <input
                        id={`wf-${field.key}`}
                        type="file"
                        accept={(field.accept ?? []).join(",")}
                        onChange={(e) => void pickFile(field, e.target.files?.[0] ?? null)}
                      />
                      {uploading === field.key && <span>上传中…</span>}
                      {answers.files[field.key] && (
                        <span className="workflow-modal-file-name">✓ {answers.files[field.key].name}</span>
                      )}
                    </div>
                  )}
                  {field.type === "rows" && (
                    <div className="workflow-modal-rows">
                      {(answers.rows[field.key] ?? []).map((row, index) => (
                        <div key={index} className="workflow-modal-row">
                          {(field.columns ?? []).map((col) => (
                            <input
                              key={col.key}
                              type="text"
                              placeholder={col.label}
                              value={row[col.key] ?? ""}
                              onChange={(e) => setRowValue(field.key, index, col.key, e.target.value)}
                            />
                          ))}
                          <button
                            className="workflow-modal-row-remove"
                            type="button"
                            aria-label={`删除第 ${index + 1} 行`}
                            onClick={() => removeRow(field, index)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        className="workflow-modal-row-add"
                        type="button"
                        onClick={() => addRow(field)}
                        disabled={(answers.rows[field.key] ?? []).length >= (field.maxRows ?? 24)}
                      >
                        + 添加一行
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="workflow-modal-actions">
              <button className="workflow-modal-cancel" type="button" onClick={onClose}>
                取消
              </button>
              <button className="workflow-modal-submit" type="submit" disabled={busy}>
                {busy ? "处理中…" : "开始"}
              </button>
            </div>
          </form>
        )}

        {run && (
          <div className="workflow-modal-result">
            <h3>{statusLabel(run.status)}</h3>
            {run.error && <p className="workflow-modal-error">{run.error}</p>}
            <ul className="workflow-modal-steps">
              {run.steps.map((step) => (
                <li key={step.id} data-status={step.status}>
                  <div className="workflow-modal-step-head">
                    <strong>{step.title}</strong>
                    <span className="workflow-modal-step-status">{stepStatusLabel(step.status)}</span>
                  </div>
                  {step.summary && <p>{step.summary}</p>}
                  {step.error && <p className="workflow-modal-error">{step.error}</p>}
                  {step.outputs.length > 0 && (
                    <ul className="workflow-modal-artifacts">
                      {step.outputs.map((artifact) => (
                        <li key={artifact.id}>
                          <a
                            href={step.skillRunId ? workflowArtifactUrl(step.skillRunId, artifact.id) : "#"}
                            download={artifact.name}
                          >
                            📥 {artifact.name}
                          </a>
                          <span>{Math.max(1, Math.round(artifact.size / 1024))} KB</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <div className="workflow-modal-actions">
              <button className="workflow-modal-cancel" type="button" onClick={onClose}>
                关闭
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
