import { apiJSON } from "../../../apps/web/src/api/client";

export interface AnalyzableFile {
  path: string;
  content: string;
  language?: string;
}

export interface ProjectAnalysisReport {
  projectId: string;
  projectName: string;
  analyzedAt: number;
  summary: {
    fileCount: number;
    totalBytes: number;
    totalLines: number;
    entryPoints: string[];
    languages: Record<string, number>;
    dependencyCount: number;
    brokenReferenceCount: number;
    syntaxErrorCount: number;
    riskCount: number;
  };
  files: Array<{
    path: string;
    kind: string;
    bytes: number;
    lines: number;
    title?: string;
    headings?: string[];
    hasViewportMeta?: boolean;
    missingAltCount?: number;
    syntaxError?: string;
  }>;
  cycles: string[][];
  risks: Array<{
    severity: "high" | "medium" | "low";
    category: string;
    file: string;
    line?: number;
    message: string;
  }>;
}

export interface PlanStep {
  id: string;
  index: number;
  title: string;
  description: string;
  agentRole: "analyzer" | "designer" | "coder" | "qa";
  dependsOn: string[];
  inputs: string[];
  expectedOutputs: string[];
  acceptanceCriteria: string[];
  rollbackStrategy: string;
}

export interface ExecutionPlan {
  goal: string;
  generatedBy: "model" | "deterministic-fallback";
  fallbackReason?: string;
  summary: string;
  risks: string[];
  appliedMemoryIds: string[];
  steps: PlanStep[];
  createdAt: number;
}

export type MemoryCategory = "preference" | "decision" | "constraint" | "fact" | "error-fix";

export interface MemoryRecord {
  id: string;
  ownerId: string;
  projectId: string;
  category: MemoryCategory;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FileDiffEntry {
  path: string;
  changeType: "added" | "modified" | "removed" | "unchanged";
  addedLines: number;
  removedLines: number;
  unifiedPatch: string;
}

export interface QAReport {
  projectId: string;
  checkedAt: number;
  passed: boolean;
  score: number;
  counts: { pass: number; warn: number; fail: number };
  checks: Array<{
    id: string;
    rule: string;
    category: string;
    status: "pass" | "warn" | "fail";
    file?: string;
    line?: number;
    detail: string;
  }>;
  diff: FileDiffEntry[];
}

export interface AgentRunRecord {
  id: string;
  ownerId: string;
  projectId: string;
  goal: string;
  status: "queued" | "running" | "waiting_approval" | "succeeded" | "failed" | "cancelled";
  attempts: number;
  executionMode: "deterministic-local" | "ai-assisted";
  awaitingApproval?: boolean;
  approvalNote?: string;
  plan: ExecutionPlan | null;
  steps: Array<{
    stepId: string;
    index: number;
    title: string;
    agentRole: "analyzer" | "designer" | "coder" | "qa";
    status: "pending" | "running" | "succeeded" | "failed" | "skipped";
    attempts: number;
    startedAt: number | null;
    completedAt: number | null;
    durationMs: number | null;
    inputSummary: string;
    outputSummary: string;
    error?: string;
  }>;
  analysisBefore: ProjectAnalysisReport | null;
  qaReport: QAReport | null;
  diff: FileDiffEntry[];
  baselineFiles: AnalyzableFile[];
  resultFiles: AnalyzableFile[];
  rolledBackAt: number | null;
  error: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface WorkspaceArchitectureSnapshot {
  generatedAt: number;
  totalSourceFiles: number;
  layers: Array<{
    layer: string;
    classification: "canonical-active" | "active-coupled" | "bridged-core" | "skeleton-unreferenced";
    fileCount: number;
    inboundEdges: number;
    outboundEdges: number;
    note: string;
  }>;
  crossLayerEdges: Array<{ from: string; to: string; count: number }>;
  bidirectionalCouplings: Array<{ pair: [string, string]; forward: number; backward: number }>;
}

export interface ServerProjectSummary {
  id: string;
  name: string;
  prompt: string;
  files: Array<{ path: string; content: string; language: "html" | "css" | "javascript" }>;
  updatedAt: string;
  createdAt: string;
  status: "draft";
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export const listServerProjects = () => apiJSON<ServerProjectSummary[]>("/projects");

export const createServerStarterProject = (name: string, prompt: string) => {
  const now = new Date().toISOString();
  return apiJSON<ServerProjectSummary>("/projects", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      id: crypto.randomUUID(),
      name,
      prompt,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      files: [
        {
          path: "index.html",
          language: "html",
          content: [
            "<!doctype html>",
            '<html lang="zh-CN">',
            "<head>",
            '  <meta charset="UTF-8" />',
            `  <title>${name}</title>`,
            "</head>",
            "<body>",
            `  <main style="max-width:960px;margin:2rem auto;font-family:system-ui,sans-serif;padding:0 1rem;">`,
            `    <h1>${name}</h1>`,
            `    <p>${prompt}</p>`,
            "  </main>",
            "</body>",
            "</html>",
          ].join("\n"),
        },
      ],
    }),
  });
};

export const fetchArchitectureSnapshot = () =>
  apiJSON<WorkspaceArchitectureSnapshot>("/agent-core/architecture");

export const analyzeServerProject = (projectId: string) =>
  apiJSON<ProjectAnalysisReport>("/agent-core/analyze", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ projectId }),
  });

export const generateServerPlan = (projectId: string, goal: string) =>
  apiJSON<{ plan: ExecutionPlan; analysis: ProjectAnalysisReport }>("/agent-core/plan", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ projectId, goal }),
  });

export const listAgentRuns = (projectId?: string) =>
  apiJSON<{ runs: AgentRunRecord[] }>(
    `/agent-core/runs${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
  );

export const executeAgentRun = (params: {
  projectId: string;
  goal: string;
  pauseBeforeApply?: boolean;
  allowExternalAi?: boolean;
  idempotencyKey?: string;
}) =>
  apiJSON<{ run: AgentRunRecord }>("/agent-core/runs", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(params),
  });

export const approveAgentRun = (
  runId: string,
  params: { files?: AnalyzableFile[]; note?: string } = {},
) =>
  apiJSON<{ run: AgentRunRecord }>(`/agent-core/runs/${encodeURIComponent(runId)}/approve`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(params),
  });

export const rejectAgentRun = (runId: string, reason?: string) =>
  apiJSON<{ run: AgentRunRecord }>(`/agent-core/runs/${encodeURIComponent(runId)}/reject`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ reason }),
  });

export const retryAgentRun = (runId: string) =>
  apiJSON<{ run: AgentRunRecord }>(`/agent-core/runs/${encodeURIComponent(runId)}/retry`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({}),
  });

export const cancelAgentRun = (runId: string) =>
  apiJSON<{ run: AgentRunRecord }>(`/agent-core/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({}),
  });

export const rollbackAgentRun = (runId: string) =>
  apiJSON<{ run: AgentRunRecord; files: ServerProjectSummary["files"] }>(
    `/agent-core/runs/${encodeURIComponent(runId)}/rollback`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({}),
    },
  );

export const listMemories = (projectId?: string) =>
  apiJSON<{ memories: MemoryRecord[] }>(
    `/agent-core/memories${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
  );

export const createMemory = (input: {
  projectId?: string;
  category: MemoryCategory;
  title: string;
  content: string;
  pinned?: boolean;
}) =>
  apiJSON<{ memory: MemoryRecord }>("/agent-core/memories", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

export const deleteMemory = (id: string) =>
  apiJSON<{ ok: boolean }>(`/agent-core/memories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
