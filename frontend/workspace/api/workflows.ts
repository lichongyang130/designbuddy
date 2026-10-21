import { apiFetch, readJSON } from "../../../apps/web/src/api/client";

/** The kinds of answer a workflow can ask for. */
export type WorkflowFieldType = "text" | "textarea" | "choice" | "number" | "file" | "rows";

export type WorkflowField = {
  key: string;
  label: string;
  type: WorkflowFieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  default?: string;
  choices?: { value: string; label: string }[];
  accept?: string[];
  columns?: { key: string; label: string; type: "text" | "number" }[];
  minRows?: number;
  maxRows?: number;
  visibleWhen?: { field: string; equals: string };
};

export type WorkflowStep = {
  id: string;
  title: string;
  skill: string;
  expertId: string;
  source: { kind: "file" | "form" | "artifact"; field?: string; builder?: string; stepId?: string; artifactName?: string };
  optional?: boolean;
  outputs: string[];
  /** Whether this step can run on this server right now. */
  availability: { ready: boolean; reason: string };
};

export type Workflow = {
  id: string;
  version: string;
  name: string;
  goal: string;
  icon: string;
  minutes: number;
  expertId: string;
  fields: WorkflowField[];
  steps: WorkflowStep[];
  outputs: string[];
  requires: string[];
  custom?: boolean;
};

export type WorkflowStepRun = {
  id: string;
  title: string;
  skill: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped" | "unavailable";
  skillRunId?: string;
  summary?: string;
  error?: string;
  note?: string;
  outputs: { id: string; name: string; mime: string; size: number; sha256: string }[];
  startedAt?: number;
  finishedAt?: number;
};

export type WorkflowRun = {
  id: string;
  ownerId: string;
  workflowId: string;
  workflowVersion: string;
  workflowName: string;
  status: "running" | "succeeded" | "failed" | "partial";
  steps: WorkflowStepRun[];
  taskId: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
  inputs: {
    fields: Record<string, string>;
    rows: Record<string, Record<string, string>[]>;
    files: Record<string, { assetId: string; name: string }>;
  };
};

export const WORKFLOW_STATUS_LABELS: Record<WorkflowRun["status"], string> = {
  running: "执行中",
  succeeded: "已完成",
  failed: "未完成",
  partial: "部分完成",
};

export const STEP_STATUS_LABELS: Record<WorkflowStepRun["status"], string> = {
  pending: "待执行",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  skipped: "已跳过",
  unavailable: "不可用",
};

/** Create and persist an owner-isolated custom skill workflow recipe. */
export async function createCustomWorkflowRecipe(input: {
  name: string;
  goal: string;
  minutes?: number;
  steps: Array<{
    title?: string;
    skill: string;
    inputMode?: "file" | "previous_artifact";
    artifactName?: string;
    optional?: boolean;
  }>;
}): Promise<Workflow> {
  const body = await readJSON<{ workflow: Workflow }>(
    await apiFetch("/workflows/recipes", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return body.workflow;
}

/** Delete an owner-isolated custom workflow recipe. */
export async function deleteCustomWorkflowRecipe(id: string): Promise<void> {
  await readJSON<{ ok: boolean }>(
    await apiFetch(`/workflows/recipes/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }),
  );
}

/** The recipes this server offers. */
export async function listWorkflows(): Promise<Workflow[]> {
  const body = await readJSON<{ workflows?: Workflow[] }>(
    await apiFetch("/workflows", { headers: { Accept: "application/json" } }),
  );
  return Array.isArray(body.workflows) ? body.workflows : [];
}

/** Start one recipe. The server checks the answers before anything runs. */
export async function startWorkflow(
  id: string,
  inputs: { fields: Record<string, unknown>; files?: Record<string, { assetId: string; name: string }> },
): Promise<WorkflowRun> {
  const body = await readJSON<{ run: WorkflowRun }>(
    await apiFetch(`/workflows/${encodeURIComponent(id)}/runs`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(inputs),
    }),
  );
  return body.run;
}

/** One run, with the state of every step. */
export async function fetchWorkflowRun(id: string): Promise<WorkflowRun> {
  const body = await readJSON<{ run: WorkflowRun }>(
    await apiFetch(`/workflow-runs/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } }),
  );
  return body.run;
}

/** The runs of this account. */
export async function listWorkflowRuns(): Promise<WorkflowRun[]> {
  const body = await readJSON<{ runs?: WorkflowRun[] }>(
    await apiFetch("/workflow-runs", { headers: { Accept: "application/json" } }),
  );
  return Array.isArray(body.runs) ? body.runs : [];
}

/** Run one step again after it failed. */
export async function retryWorkflowStep(runId: string, stepId: string): Promise<WorkflowRun> {
  const body = await readJSON<{ run: WorkflowRun }>(
    await apiFetch(`/workflow-runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/retry`, {
      method: "POST",
      headers: { Accept: "application/json" },
    }),
  );
  return body.run;
}

/** The download address of one artifact of a step. */
export function workflowArtifactUrl(skillRunId: string, artifactId: string): string {
  return `/api/skill-runs/${encodeURIComponent(skillRunId)}/artifacts/${encodeURIComponent(artifactId)}`;
}

/** Download the bytes of one artifact of a step. */
export async function fetchWorkflowArtifact(skillRunId: string, artifactId: string): Promise<Blob> {
  const response = await apiFetch(
    `/skill-runs/${encodeURIComponent(skillRunId)}/artifacts/${encodeURIComponent(artifactId)}`,
    { headers: { Accept: "*/*" } },
  );
  if (!response.ok) throw Error("产物下载失败，请刷新后重试。");
  return await response.blob();
}
