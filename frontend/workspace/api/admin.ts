import { apiFetch, readJSON } from "../../../apps/web/src/api/client";

/** The operator console snapshot the server returns. */
export type AdminOverview = {
  generatedAt: number;
  admins: string[];
  accounts: {
    total: number;
    disabled: number;
    list: {
      id: string;
      username: string;
      displayName: string;
      email: string;
      createdAt: string;
      disabled: boolean;
    }[];
  };
  usage: {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    errors: number;
    averageLatencyMs: number;
    byOwner: { ownerId: string; calls: number; totalTokens: number; errors: number }[];
    byModel: { model: string; provider: string; calls: number; totalTokens: number }[];
  };
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    byKind: Record<string, number>;
    failures: { id: string; ownerId: string; projectId: string; kind: string; title: string; error: string; updatedAt: number }[];
  };
  schedules: {
    total: number;
    enabled: number;
    list: {
      id: string;
      ownerId: string;
      name: string;
      cron: string;
      timezone: string;
      enabled: boolean;
      lastRunAt: number;
      nextRunAt: number;
      lastStatus: string;
      lastDetail: string;
    }[];
  };
  skills: {
    total: number;
    ready: number;
    unavailable: number;
    unavailableList: { id: string; name: string; reason: string }[];
  };
  audit: { id: string; accountId: string; username: string; action: string; detail: string; createdAt: number }[];
};

/** Read the console. It refuses with a clear message when the caller is not an operator. */
export async function fetchAdminOverview(): Promise<AdminOverview> {
  const body = await readJSON<{ overview: AdminOverview }>(
    await apiFetch("/admin/overview", { headers: { Accept: "application/json" } }),
  );
  return body.overview;
}

/** Turn an account off or on. A disabled account loses its sessions. */
export async function setAdminAccountDisabled(id: string, disabled: boolean): Promise<void> {
  await readJSON(
    await apiFetch(`/admin/accounts/${encodeURIComponent(id)}/status`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !disabled }),
    }),
  );
}

/** Retry a failed task for its owner. */
export async function retryAdminTask(ownerId: string, taskId: string): Promise<void> {
  await readJSON(
    await apiFetch(`/admin/tasks/${encodeURIComponent(ownerId)}/${encodeURIComponent(taskId)}/retry`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: "{}",
    }),
  );
}

/** Stop or start a schedule. */
export async function setAdminScheduleEnabled(ownerId: string, id: string, enabled: boolean): Promise<void> {
  await readJSON(
    await apiFetch(`/admin/schedules/${encodeURIComponent(ownerId)}/${encodeURIComponent(id)}/status`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),
  );
}
