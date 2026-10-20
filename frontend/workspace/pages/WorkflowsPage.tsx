import type { ExpertTaskPlan } from "../../../shared/expertExecution";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { navigateTo } from "../workspaceRoutes";
import { uploadAsset } from "../api/assets";
import { updateProject } from "../projectStore";
import { useRuntimeActivity } from "../runtimeActivity";
import { saveProjectToCloud } from "../api/projects";
import type { DesignProject } from "../models/project";
import {
  fetchWorkflowArtifact,
  fetchWorkflowRun,
  listWorkflowRuns,
  listWorkflows,
  retryWorkflowStep,
  startWorkflow,
  workflowArtifactUrl,
  STEP_STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
  type Workflow,
  type WorkflowField,
  type WorkflowRun,
  type WorkflowStepRun,
} from "../api/workflows";
import "./workflows.css";

type Row = Record<string, string>;

type Answers = {
  fields: Record<string, string>;
  rows: Record<string, Row[]>;
  files: Record<string, { assetId: string; name: string }>;
};

const EMPTY: Answers = { fields: {}, rows: {}, files: {} };

/** The artifacts a person can keep editing as source. */
const TEXT_ARTIFACTS = /\.(html?|svg|json|md|txt|csv|xml)$/i;

function languageFor(name: string): DesignProject["files"][number]["language"] {
  if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".js")) return "javascript";
  if (name.endsWith(".json")) return "json";
  return "text";
}

/** The recipes, the wizard and the result of one run. */
type WorkflowsPageProps = { embedded?: boolean; initialWorkflowId?: string; taskId?: string; executionPlan?: ExpertTaskPlan; onRun?: () => void };
export default function WorkflowsPage(props: WorkflowsPageProps) {
  const [identity, setIdentity] = useState(0);
  useEffect(() => {
    const changed = () => setIdentity((value) => value + 1);
    window.addEventListener("designbuddy:server-identity", changed);
    return () =>
      window.removeEventListener("designbuddy:server-identity", changed);
  }, []);
  return <WorkflowWorkspace key={identity} {...props} />;
}
function WorkflowWorkspace({
  embedded = false,
  initialWorkflowId, taskId, executionPlan, onRun,
}: WorkflowsPageProps) {
  const Container = embedded ? "div" : "main";
  const mounted = useRef(true);
  const sending = useRef(false);
  const submission = useRef<{ signature: string; id: string } | null>(null);
  const requests = useRef(new AbortController());
  const following = useRef<AbortController | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    mounted.current = true;
    requests.current = new AbortController();
    return () => {
      mounted.current = false;
      requests.current.abort();
      following.current?.abort();
    };
  }, []);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [stage, setStage] = useState<"cards" | "form" | "confirm" | "result">(
    "cards",
  );
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  useRuntimeActivity(busy || run?.status === "running");
  // A background load must not wipe the message of an action the person just
  // triggered, so an action error survives the next load.
  const actionError = useRef(false);
  const fail = (message: string) => {
    actionError.current = true;
    setError(message);
  };
  const clearError = () => {
    actionError.current = false;
    setError("");
  };

  const load = useCallback(async () => {
    try {
      const [list, history] = await Promise.all([
        listWorkflows(requests.current.signal),
        listWorkflowRuns(requests.current.signal, taskId),
      ]);
      if (!mounted.current || requests.current.signal.aborted) return;
      setWorkflows(list);
      setRuns(history);
      if (!actionError.current) setError("");
    } catch (cause) {
      if (mounted.current && !requests.current.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "工作流服务暂不可用。",
        );
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const wanted =
      initialWorkflowId ||
      new URLSearchParams(window.location.search).get("workflow");
    if (!wanted || !workflows.length || initialized.current) return;
    initialized.current = true;
    const recipe = workflows.find((workflow) => workflow.id === wanted);
    if (recipe) {
      const previous = executionPlan && taskId ? runs.find(r => r.workflowId === recipe.id && r.parentTaskId === taskId) : undefined;
      if (previous) void openRun(previous);
      else start(recipe);
    }
    else fail("未找到指定流程，未自动选择其他执行器。");
  }, [workflows, initialWorkflowId, runs]);

  /** Stopping this observer does not cancel the persisted server run. */
  const follow = useCallback(async (runId: string) => {
    if (!mounted.current) return null;
    following.current?.abort();
    const controller = new AbortController();
    following.current = controller;
    try {
      for (
        let attempt = 0;
        attempt < 360 && !controller.signal.aborted;
        attempt++
      ) {
        const current = await fetchWorkflowRun(runId, controller.signal);
        if (!mounted.current || controller.signal.aborted) return null;
        setRun(current);
        if (current.status !== "running") return current;
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", done);
            resolve();
          };
          const timer = setTimeout(done, 1000);
          controller.signal.addEventListener("abort", done, { once: true });
        });
      }
      if (mounted.current && !controller.signal.aborted)
        setNotice("后台仍在处理，可从运行历史继续查看；没有取消任务。");
      return null;
    } catch (cause) {
      if (controller.signal.aborted || !mounted.current) return null;
      throw cause;
    }
  }, []);

  function start(workflow: Workflow) {
    following.current?.abort();
    setSelected(workflow);
    setStage("form");
    setRun(null);
    // The declared defaults are the answers the person starts with.
    const defaults: Record<string, string> = {};
    for (const field of workflow.fields) {
      if (field.default !== undefined) defaults[field.key] = field.default;
    }
    setAnswers({ fields: defaults, rows: {}, files: {} });
    setNotice("");
    clearError();
  }

  /** Show the result of a run from the history. */
  async function openRun(item: WorkflowRun) {
    setSelected(
      workflows.find((workflow) => workflow.id === item.workflowId) ?? null,
    );
    setStage("result");
    setRun(item);
    clearError();
    if (item.status === "running") {
      try {
        await follow(item.id);
      } catch (cause) {
        if (mounted.current)
          fail(cause instanceof Error ? cause.message : "无法读取运行状态。");
      }
    }
  }

  function backToCards() {
    following.current?.abort();
    setSelected(null);
    setStage("cards");
    setRun(null);
    setAnswers(EMPTY);
    setNotice("");
    clearError();
  }

  const visibleFields = useMemo(() => {
    if (!selected) return [];
    return selected.fields.filter((field) => {
      if (!field.visibleWhen) return true;
      return (
        (answers.fields[field.visibleWhen.field] ?? "") ===
        field.visibleWhen.equals
      );
    });
  }, [selected, answers.fields]);

  function setField(key: string, value: string) {
    setAnswers((current) => ({
      ...current,
      fields: { ...current.fields, [key]: value },
    }));
  }

  function setRowValue(
    rowKey: string,
    index: number,
    column: string,
    value: string,
  ) {
    setAnswers((current) => {
      const list = [...(current.rows[rowKey] ?? [])];
      list[index] = { ...(list[index] ?? {}), [column]: value };
      return { ...current, rows: { ...current.rows, [rowKey]: list } };
    });
  }

  function addRow(field: WorkflowField) {
    setAnswers((current) => {
      const list = [...(current.rows[field.key] ?? [])];
      const empty: Row = {};
      for (const column of field.columns ?? []) empty[column.key] = "";
      list.push(empty);
      return { ...current, rows: { ...current.rows, [field.key]: list } };
    });
  }

  function removeRow(field: WorkflowField, index: number) {
    setAnswers((current) => {
      const list = [...(current.rows[field.key] ?? [])];
      list.splice(index, 1);
      return { ...current, rows: { ...current.rows, [field.key]: list } };
    });
  }

  async function pickFile(field: WorkflowField, file: File | null) {
    if (!file) return;
    setUploading(field.key);
    try {
      const asset = await uploadAsset(file);
      if (!mounted.current) return;
      setAnswers((current) => ({
        ...current,
        files: {
          ...current.files,
          [field.key]: { assetId: asset.id, name: asset.name },
        },
      }));
      clearError();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "文件上传失败。");
    } finally {
      setUploading("");
    }
  }

  /** Check the answers before the confirmation step. */
  function missingAnswers(): string[] {
    if (!selected) return [];
    const missing: string[] = [];
    for (const field of visibleFields) {
      if (!field.required) continue;
      if (field.type === "rows") {
        const list = answers.rows[field.key] ?? [];
        const min = field.minRows ?? 1;
        const filled = list.filter((row) =>
          Object.values(row).some((value) => value.trim().length > 0),
        );
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

  async function confirmAndRun() {
    if (!selected || busy || sending.current || (executionPlan && !executionPlan.ready)) return;
    sending.current = true;
    setBusy(true);
    try {
      const signature = JSON.stringify({ planId: executionPlan?.id, answers });
      if (submission.current?.signature !== signature) submission.current = { signature, id: crypto.randomUUID() };
      const started = await startWorkflow(selected.id, {
        fields: { ...answers.fields, ...answers.rows },
        files: answers.files,
      }, executionPlan ? { plan: executionPlan, requestId: submission.current.id } : undefined);
      if (!mounted.current) return;
      onRun?.();
      setRun(started);
      setStage("result");
      setNotice("已提交，正在按步骤执行。");
      clearError();
      await follow(started.id);
      await load();
    } catch (cause) {
      if (mounted.current) fail(cause instanceof Error ? cause.message : "工作流没有启动。");
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  /** Open a text artifact in the editor as a new project. */
  async function keepEditing(
    step: WorkflowStepRun,
    artifact: { id: string; name: string; mime: string },
  ) {
    if (!step.skillRunId || !run || busy) return;
    setBusy(true);
    try {
      const blob = await fetchWorkflowArtifact(step.skillRunId, artifact.id);
      const content = await blob.text();
      if (!mounted.current) return;
      const now = new Date().toISOString();
      const project: DesignProject = {
        id: crypto.randomUUID(),
        name: `${run.workflowName} · ${artifact.name}`.slice(0, 48),
        prompt: `工作流「${run.workflowName}」的产物：${artifact.name}`,
        files: [
          {
            path: artifact.name,
            language: languageFor(artifact.name),
            content,
          },
        ],
        createdAt: now,
        updatedAt: now,
        status: "draft",
      };
      updateProject(project);
      // The server keeps a copy with the version history, so the edit can be
      // continued on another device as well.
      await saveProjectToCloud(project).catch(() => undefined);
      if (!mounted.current) return;
      setNotice(`已把「${artifact.name}」送进编辑器，可以继续改。`);
      clearError();
      navigateTo(`/editor/${project.id}`);
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "无法打开产物。");
    } finally {
      setBusy(false);
    }
  }

  /** Keep an artifact in the server asset library. */
  async function keepAsAsset(
    step: WorkflowStepRun,
    artifact: { id: string; name: string; mime: string },
  ) {
    if (!step.skillRunId || busy) return;
    setBusy(true);
    try {
      const blob = await fetchWorkflowArtifact(step.skillRunId, artifact.id);
      if (!mounted.current) return;
      const file = new File([blob], artifact.name, {
        type: artifact.mime || "application/octet-stream",
      });
      const asset = await uploadAsset(file);
      setNotice(`已把「${artifact.name}」存进素材库，可在素材页找到。`);
      clearError();
      void asset;
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "无法保存到素材库。");
    } finally {
      setBusy(false);
    }
  }

  async function retry(step: WorkflowStepRun) {
    if (!run || busy) return;
    setBusy(true);
    try {
      const updated = await retryWorkflowStep(run.id, step.id);
      setRun(updated);
      clearError();
      await follow(run.id);
      await load();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "重试失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={embedded ? "wf-embedded" : "workbuddy-app community-workspace"}
    >
      {!embedded && (
        <WorkBuddySidebar
          active="plugins"
          go={navigateTo}
          setNotice={setNotice}
          projectCount={0}
          workspaceCount={0}
        />
      )}
      <Container className="wf-main" aria-label="工作流">
        <div className="wf-content">
          {!embedded && (
            <section className="wf-hero">
              <div>
                <span className="wf-eyebrow">点几下完成一件事</span>
                <h1>工作流</h1>
                <p>
                  每条工作流是一串已经登记的技能：填几个答案，服务器按顺序真的跑一遍，
                  跑完给你产物。缺凭据或没授权的步骤会写明缺什么，不会用假结果糊弄过去。
                </p>
              </div>
            </section>
          )}

          {(error || notice) && (
            <p
              className={error ? "wf-message is-error" : "wf-message"}
              role="status"
            >
              {error || notice}
            </p>
          )}

          {stage === "cards" && (
            <>
              <section className="wf-card-wall" aria-label="工作流列表">
                {workflows
                  .filter(
                    (workflow) =>
                      !embedded || workflow.id === initialWorkflowId,
                  )
                  .map((workflow) => {
                    const blocked = workflow.steps.filter(
                      (step) => !step.availability.ready,
                    );
                    return (
                      <article
                        key={workflow.id}
                        className="wf-recipe"
                        data-workflow={workflow.id}
                      >
                        <h2>{workflow.name}</h2>
                        <p className="wf-goal">{workflow.goal}</p>
                        <p className="wf-meta">
                          约 {workflow.minutes} 分钟 · {workflow.steps.length}{" "}
                          个步骤 · {workflow.outputs.join("、")}
                        </p>
                        {blocked.length > 0 && (
                          <p className="wf-blocked">
                            其中 {blocked.length}{" "}
                            个步骤在当前环境不能执行（其余步骤照常跑）：
                            {blocked[0].availability.reason}
                          </p>
                        )}
                        <button
                          className="wf-button is-primary"
                          type="button"
                          onClick={() => start(workflow)}
                        >
                          开始
                        </button>
                      </article>
                    );
                  })}
                {!workflows.length && (
                  <p className="wf-empty">还没有可用的工作流。</p>
                )}
              </section>

              <section className="wf-card" aria-label="最近运行">
                <h2>最近运行（{runs.length}）</h2>
                {runs.length === 0 && (
                  <p className="wf-note">
                    还没有运行记录。选一条工作流就能开始。
                  </p>
                )}
                <ul className="wf-run-list">
                  {runs
                    .filter(
                      (item) =>
                        !embedded || item.workflowId === initialWorkflowId,
                    )
                    .map((item) => (
                      <li key={item.id}>
                        <button
                          className="wf-run-open"
                          type="button"
                          onClick={() => void openRun(item)}
                        >
                          {item.workflowName} ·{" "}
                          {WORKFLOW_STATUS_LABELS[item.status]} ·{" "}
                          {new Date(item.createdAt).toLocaleString("zh-CN")}
                        </button>
                        {item.error && <em>{item.error}</em>}
                      </li>
                    ))}
                </ul>
              </section>
            </>
          )}

          {stage === "form" && selected && (
            <section className="wf-card" aria-label="填写信息">
              <div className="wf-steps" aria-hidden="true">
                <span className="is-current">1 填写</span>
                <span>2 确认</span>
                <span>3 结果</span>
              </div>
              <h2>{selected.name}</h2>
              <p className="wf-note">{selected.goal}</p>
              <form
                className="wf-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const missing = missingAnswers();
                  if (missing.length) {
                    fail(`请先填写：${missing.join("、")}`);
                    return;
                  }
                  setStage("confirm");
                  clearError();
                }}
              >
                {visibleFields.map((field) => (
                  <div
                    key={field.key}
                    className="wf-field"
                    data-field={field.key}
                  >
                    <label htmlFor={`wf-${field.key}`}>
                      {field.label}
                      {field.required && <span aria-hidden="true"> *</span>}
                    </label>
                    {field.help && <p className="wf-help">{field.help}</p>}
                    {field.type === "text" && (
                      <input
                        id={`wf-${field.key}`}
                        aria-label={field.label}
                        type="text"
                        value={answers.fields[field.key] ?? field.default ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setField(field.key, event.target.value)
                        }
                      />
                    )}
                    {field.type === "textarea" && (
                      <textarea
                        id={`wf-${field.key}`}
                        aria-label={field.label}
                        rows={3}
                        value={answers.fields[field.key] ?? field.default ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setField(field.key, event.target.value)
                        }
                      />
                    )}
                    {field.type === "choice" && (
                      <select
                        id={`wf-${field.key}`}
                        aria-label={field.label}
                        value={answers.fields[field.key] ?? field.default ?? ""}
                        onChange={(event) =>
                          setField(field.key, event.target.value)
                        }
                      >
                        {(field.choices ?? []).map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {field.type === "file" && (
                      <div className="wf-file">
                        <input
                          id={`wf-${field.key}`}
                        aria-label={field.label}
                          type="file"
                          accept={(field.accept ?? []).join(",")}
                          onChange={(event) =>
                            void pickFile(
                              field,
                              event.target.files?.[0] ?? null,
                            )
                          }
                        />
                        {uploading === field.key && (
                          <span>正在上传到服务器素材库…</span>
                        )}
                        {answers.files[field.key] && (
                          <span className="wf-file-name">
                            已上传：{answers.files[field.key].name}
                          </span>
                        )}
                      </div>
                    )}
                    {field.type === "rows" && (
                      <div className="wf-rows">
                        {(answers.rows[field.key] ?? []).map((row, index) => (
                          <div key={index} className="wf-row">
                            {(field.columns ?? []).map((column) => (
                              <label key={column.key} className="wf-cell">
                                <span>{column.label}</span>
                                <input
                                  type="text"
                                  value={row[column.key] ?? ""}
                                  onChange={(event) =>
                                    setRowValue(
                                      field.key,
                                      index,
                                      column.key,
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                            ))}
                            <button
                              className="wf-button is-quiet"
                              type="button"
                              aria-label={`删除第 ${index + 1} 行`}
                              onClick={() => removeRow(field, index)}
                            >
                              删除
                            </button>
                          </div>
                        ))}
                        <button
                          className="wf-button"
                          type="button"
                          onClick={() => addRow(field)}
                          disabled={
                            (answers.rows[field.key] ?? []).length >=
                            (field.maxRows ?? 24)
                          }
                        >
                          添加一行
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <div className="wf-actions">
                  <button
                    className="wf-button"
                    type="button"
                    onClick={backToCards}
                  >
                    返回
                  </button>
                  <button className="wf-button is-primary" type="submit">
                    下一步：确认
                  </button>
                </div>
              </form>
            </section>
          )}

          {stage === "confirm" && selected && (
            <section className="wf-card" aria-label="确认信息">
              <div className="wf-steps" aria-hidden="true">
                <span>1 填写</span>
                <span className="is-current">2 确认</span>
                <span>3 结果</span>
              </div>
              <h2>确认要跑什么</h2>
              <ol className="wf-plan">
                {selected.steps.map((step) => (
                  <li key={step.id}>
                    <strong>{step.title}</strong>
                    <span>
                      技能 {step.skill} · 产出 {step.outputs.join("、")}
                    </span>
                    {!step.availability.ready && (
                      <em className="wf-blocked">{step.availability.reason}</em>
                    )}
                  </li>
                ))}
              </ol>
              <h3>会用到的数据</h3>
              <ul className="wf-answers">
                {Object.entries(answers.fields).map(([key, value]) => (
                  <li key={key}>
                    <span>{key}</span>
                    <em>{value || "（空）"}</em>
                  </li>
                ))}
                {Object.entries(answers.files).map(([key, file]) => (
                  <li key={key}>
                    <span>{key}</span>
                    <em>{file.name}</em>
                  </li>
                ))}
              </ul>
              {selected.requires.length > 0 && (
                <p className="wf-blocked">
                  这条工作流还需要：{selected.requires.join("；")}
                </p>
              )}
              <p className="wf-note">
                提交后文件会保存到服务器后台并按上面的技能执行；不会把内容发给未授权的第三方服务。
              </p>
              <div className="wf-actions">
                <button
                  className="wf-button"
                  type="button"
                  onClick={() => setStage("form")}
                >
                  返回修改
                </button>
                <button
                  className="wf-button is-primary"
                  type="button"
                  disabled={busy || (executionPlan && !executionPlan.ready)}
                  onClick={() => void confirmAndRun()}
                >
                  {busy ? "正在提交…" : "确认并执行"}
                </button>
              </div>
            </section>
          )}

          {stage === "result" && run && (
            <section className="wf-card" aria-label="执行结果">
              <div className="wf-steps" aria-hidden="true">
                <span>1 填写</span>
                <span>2 确认</span>
                <span className="is-current">3 结果</span>
              </div>
              <h2>
                {run.workflowName} · {WORKFLOW_STATUS_LABELS[run.status]}
              </h2>
              <p className="wf-delivery-note" role="status">{run.delivery?.classification==="diagnostic"?"诊断草稿 · 未通过全部工序":"草稿 · 待人工商业验收"}。{run.delivery?.automatedChecks==="passed"?"已实现的自动检查门槛未发现阻断，不代表浏览器、业务正确性或商业认证。":run.delivery?.automatedChecks==="blocked"?"自动检查存在阻断，保留原始产物与报告供修复，不作为正式交付批准。":"执行状态只记录工序结果；未完成的检查与外部验收不能视为通过。"}</p>
              {run?.error && <p className="wf-message is-error">{run.error}</p>}
              <ul className="wf-steps-list">
                {(run?.steps ?? []).map((step) => (
                  <li
                    key={step.id}
                    data-step={step.id}
                    data-status={step.status}
                  >
                    <div className="wf-step-head">
                      <strong>{step.title}</strong>
                      <span className="wf-status" data-status={step.status}>
                        {STEP_STATUS_LABELS[step.status]}
                      </span>
                    </div>
                    <span className="wf-step-skill">技能 {step.skill}</span>
                    {step.summary && (
                      <p className="wf-step-summary">{step.summary}</p>
                    )}
                    {step.error && (
                      <p className="wf-step-error">{step.error}</p>
                    )}
                    {step.note && <p className="wf-step-note">{step.note}</p>}
                    {step.outputs.length > 0 && (
                      <ul className="wf-artifacts">
                        {step.outputs.map((artifact) => (
                          <li key={artifact.id}>
                            <a
                              href={
                                step.skillRunId
                                  ? workflowArtifactUrl(
                                      step.skillRunId,
                                      artifact.id,
                                    )
                                  : "#"
                              }
                              download={artifact.name}
                            >
                              {artifact.name}
                            </a>
                            <span>
                              {Math.max(1, Math.round(artifact.size / 1024))} KB
                            </span>
                            {TEXT_ARTIFACTS.test(artifact.name) && (
                              <button
                                className="wf-button is-quiet"
                                type="button"
                                disabled={busy}
                                onClick={() => void keepEditing(step, artifact)}
                              >
                                继续编辑
                              </button>
                            )}
                            <button
                              className="wf-button is-quiet"
                              type="button"
                              disabled={busy}
                              onClick={() => void keepAsAsset(step, artifact)}
                            >
                              存为素材
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {(step.status === "failed" ||
                      step.status === "unavailable" ||
                      step.status === "skipped") && (
                      <button
                        className="wf-button"
                        type="button"
                        disabled={busy || !step.skillRunId}
                        onClick={() => void retry(step)}
                      >
                        重试这一步
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="wf-actions">
                {executionPlan && selected && <button type="button" className="wf-button" disabled={busy || run.status === "running"} onClick={() => {
                  const inputs = run.inputs;
                  start(selected);
                  setAnswers({ fields: { ...inputs.fields }, rows: structuredClone(inputs.rows), files: structuredClone(inputs.files) });
                  setNotice("已载入上一版的真实输入。请修改并重新确认，新运行和产物将单独保存，不覆盖原件。");
                }}>基于此版本继续修改</button>}
                <button
                  className="wf-button"
                  type="button"
                  onClick={backToCards}
                >
                  返回工作流列表
                </button>
                <button
                  className="wf-button"
                  type="button"
                  onClick={() => void load()}
                >
                  刷新结果
                </button>
              </div>
            </section>
          )}
        </div>
      </Container>
    </div>
  );
}
