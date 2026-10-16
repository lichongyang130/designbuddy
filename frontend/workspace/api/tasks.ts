import { apiFetch, apiJSON } from "../../../apps/web/src/api/client";

/**
 * Server-backed task and notification access.
 *
 * The browser keeps a local mirror for instant rendering, but the server copy
 * is the record of truth: a task or notification survives a refresh, another
 * browser and another device, and stays scoped to the signed-in identity.
 */
export type ServerNotification = {
  id: string;
  taskId: string | null;
  projectId: string;
  kind: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: number;
};

export type ServerTask = {
  id: string;
  projectId: string;
  kind: string;
  title: string;
  status: string;
  payload: string;
  summary: string;
  error: string;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};

export type ServerSchedule = {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  url: string;
  expectStatus: number;
  timeoutMs: number;
  enabled: boolean;
  lastRunAt: number | null;
  nextRunAt: number | null;
  lastStatus: string;
};

export async function fetchNotifications(): Promise<ServerNotification[]> {
  const body = await apiJSON<{ notifications: ServerNotification[] }>("/notifications");
  return Array.isArray(body.notifications) ? body.notifications : [];
}

export async function postNotification(input: {
  id: string;
  projectId: string;
  messageId: string;
  kind: string;
  title: string;
  description: string;
}): Promise<void> {
  await apiFetch("/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The server keeps the originating message id, so a synced notification can
    // still be matched with the conversation message it came from.
    body: JSON.stringify({ ...input, taskId: input.messageId }),
  });
}

export async function markServerNotificationRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
}

export async function markAllServerNotificationsRead(): Promise<void> {
  await apiFetch("/notifications/read-all", { method: "POST" });
}

export async function deleteServerNotification(id: string): Promise<void> {
  await apiFetch(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchTasks(projectId?: string): Promise<ServerTask[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const body = await apiJSON<{ tasks: ServerTask[] }>(`/tasks${query}`);
  return Array.isArray(body.tasks) ? body.tasks : [];
}

export async function saveTask(task: {
  id?: string;
  projectId: string;
  kind: string;
  title: string;
  status: string;
  payload?: string;
  summary?: string;
  error?: string;
}): Promise<ServerTask> {
  const body = await apiJSON<{ task: ServerTask }>("/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  return body.task;
}

export async function retryTask(id: string): Promise<ServerTask> {
  const body = await apiJSON<{ task: ServerTask }>(`/tasks/${encodeURIComponent(id)}/retry`, { method: "POST" });
  return body.task;
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchSchedules(): Promise<ServerSchedule[]> {
  const body = await apiJSON<{ schedules: ServerSchedule[] }>("/schedules");
  return Array.isArray(body.schedules) ? body.schedules : [];
}

export async function saveSchedule(schedule: {
  id?: string;
  name: string;
  cron: string;
  timezone: string;
  url: string;
  expectStatus?: number;
  timeoutMs?: number;
  enabled?: boolean;
}): Promise<ServerSchedule> {
  const body = await apiJSON<{ schedule: ServerSchedule }>("/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schedule),
  });
  return body.schedule;
}

export async function deleteSchedule(id: string): Promise<void> {
  await apiFetch(`/schedules/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchScheduleRuns(id: string): Promise<{ id: string; startedAt: number; finishedAt: number | null; status: string; detail: string }[]> {
  const body = await apiJSON<{ runs: { id: string; startedAt: number; finishedAt: number | null; status: string; detail: string }[] }>(
    `/schedules/${encodeURIComponent(id)}/runs`,
  );
  return Array.isArray(body.runs) ? body.runs : [];
}
