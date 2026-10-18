import { useEffect, useState } from "react";
import type { TaskConversation } from "./taskConversation";
import {
  deleteServerNotification,
  fetchNotifications,
  markAllServerNotificationsRead,
  markServerNotificationRead,
  postNotification,
} from "./api/tasks";

export interface WorkspaceNotification {
  id: string;
  projectId: string;
  messageId: string;
  kind: "complete" | "error" | "action";
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
}
const key = "designbuddy.notifications.v1";
const eventName = "designbuddy:notifications";
let memory: WorkspaceNotification[] = [];
let storageFailed = false;
function valid(value: unknown): value is WorkspaceNotification {
  if (!value || typeof value !== "object") return false;
  const n = value as WorkspaceNotification;
  return typeof n.id === "string" && n.id.length <= 500 && typeof n.projectId === "string" && !!n.projectId && n.projectId.length <= 200 && typeof n.messageId === "string" && n.messageId.length <= 200 && ["complete", "error", "action"].includes(n.kind) && typeof n.title === "string" && n.title.length <= 120 && typeof n.description === "string" && n.description.length <= 400 && typeof n.createdAt === "string" && Number.isFinite(Date.parse(n.createdAt)) && typeof n.read === "boolean";
}
export function readNotifications(): WorkspaceNotification[] {
  if (storageFailed) return memory;
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    memory = Array.isArray(data) ? data.filter(valid).slice(0, 100) : [];
  } catch { memory = []; }
  return memory;
}
function write(items: WorkspaceNotification[]) {
  memory = items.slice(0, 100);
  try { localStorage.setItem(key, JSON.stringify(memory)); storageFailed = false; }
  catch { storageFailed = true; }
  window.dispatchEvent(new CustomEvent(eventName, { detail: { items: memory, storageFailed } }));
}

/** Server pushes that are still in flight, so later actions cannot overtake them. */
const pendingPushes = new Map<string, Promise<void>>();
function afterPush(id: string, action: () => Promise<unknown>) {
  const pending = pendingPushes.get(id);
  if (pending) void pending.then(() => action()).catch(() => undefined);
  else void action().catch(() => undefined);
}

export function markNotificationRead(id?: string) {
  write(readNotifications().map((n) => !id || n.id === id ? { ...n, read: true } : n));
  if (id) afterPush(id, () => markServerNotificationRead(id));
  else void markAllServerNotificationsRead().catch(() => undefined);
}
export function removeNotification(id: string) {
  write(readNotifications().filter((n) => n.id !== id));
  // The delete has to happen after the create, otherwise the server copy would
  // survive and come back on the next sync.
  afterPush(id, () => deleteServerNotification(id));
}
export function clearReadNotifications() {
  const items = readNotifications();
  const cleared = items.filter((n) => n.read);
  write(items.filter((n) => !n.read));
  // Remove them from the server inbox too, otherwise the next sync brings them back.
  for (const item of cleared) afterPush(item.id, () => deleteServerNotification(item.id));
}

/**
 * Pull the real inbox from the server and merge it into the local mirror.
 * The server copy is the record of truth; local-only entries stay visible so
 * an offline browser does not lose what it just produced.
 */
export async function syncNotificationsFromServer(): Promise<WorkspaceNotification[]> {
  const remote = await fetchNotifications();
  const local = readNotifications();
  const remoteIds = new Set(remote.map((item) => item.id));
  const merged: WorkspaceNotification[] = [
    ...remote.map((item) => {
      const localItem = local.find((entry) => entry.id === item.id);
      // A read state the user already applied here wins until the server
      // confirms it; otherwise a slow server copy would bring the unread dot back.
      const read = item.read || Boolean(localItem?.read);
      if (read && !item.read) void markServerNotificationRead(item.id).catch(() => undefined);
      return {
        id: item.id,
        projectId: item.projectId,
        messageId: item.taskId || localItem?.messageId || item.id,
        kind: (["complete", "error", "action"].includes(item.kind) ? item.kind : "complete") as WorkspaceNotification["kind"],
        title: item.title,
        description: item.description,
        createdAt: new Date(item.createdAt).toISOString(),
        read,
      };
    }),
    ...local.filter((item) => !remoteIds.has(item.id) && !item.id.startsWith("srv-")),
  ].slice(0, 100);
  write(merged);
  return merged;
}

/** Push a locally produced notification into the server inbox. */
export function pushNotificationToServer(item: WorkspaceNotification): Promise<void> {
  const promise = postNotification({
    id: item.id,
    projectId: item.projectId,
    messageId: item.messageId,
    kind: item.kind,
    title: item.title,
    description: item.description,
  }).catch(() => undefined);
  pendingPushes.set(item.id, promise);
  void promise.then(() => { if (pendingPushes.get(item.id) === promise) pendingPushes.delete(item.id); });
  return promise;
}

/** Called after real conversation persistence, never populated with promotional/demo events. */
export function recordTaskNotifications(task: TaskConversation, previous: TaskConversation | null) {
  let items = readNotifications();
  let changed = false;
  items = items.map((n) => {
    if (n.projectId === task.projectId && n.kind === "action" && !n.read) {
      const message = task.messages.find((m) => m.id === n.messageId);
      if (message && message.clarification?.state !== "pending") { changed = true; return { ...n, read: true }; }
    }
    return n;
  });
  const message = task.messages.at(-1);
  const before = previous?.messages.find((m) => m.id === message?.id);
  let createdId = "";
  if (message?.role === "assistant" && message.status !== before?.status) {
    const kind = message.status === "error" ? "error" : message.status === "clarifying" ? "action" : message.status === "complete" && !message.clarification ? "complete" : null;
    if (kind) {
      // The id travels in a URL path segment, so it only uses unreserved characters.
      const id = `${task.projectId}:${message.id}:${kind}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
      const brief = task.messages.find((m) => m.role === "user")?.content.slice(0, 100) || "任务";
      const n: WorkspaceNotification = { id, projectId: task.projectId, messageId: message.id, kind, title: kind === "error" ? "任务回复失败" : kind === "action" ? "任务等待确认" : message.artifact ? "项目文件已生成" : "AI 回复已完成", description: `${brief}${kind === "error" && message.error ? ` · ${message.error.slice(0, 160)}` : ""}`, createdAt: new Date().toISOString(), read: false };
      items = [n, ...items.filter((item) => item.id !== id)];
      createdId = id;
      changed = true;
    }
  }
  if (changed) {
    write(items);
    const created = createdId ? items.find((item) => item.id === createdId) : undefined;
    if (created) void pushNotificationToServer(created).catch(() => undefined);
  }
}

export function useNotifications() {
  const [snapshot, setSnapshot] = useState(() => ({ items: readNotifications(), storageFailed, serverSynced: false, serverError: "" }));
  useEffect(() => {
    const sync = (event: Event) => setSnapshot((event as CustomEvent).detail);
    const storage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        storageFailed = false;
        setSnapshot({ items: readNotifications(), storageFailed, serverSynced: false, serverError: "" });
      }
    };
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", storage);
    setSnapshot({ items: readNotifications(), storageFailed, serverSynced: false, serverError: "" });
    // The server inbox is the record of truth; a failure must not hide the local list.
    void syncNotificationsFromServer()
      .then(() => setSnapshot({ items: readNotifications(), storageFailed, serverSynced: true, serverError: "" }))
      .catch(() => setSnapshot({ items: readNotifications(), storageFailed, serverSynced: false, serverError: "服务器收件箱暂时不可用" }));
    return () => { window.removeEventListener(eventName, sync); window.removeEventListener("storage", storage); };
  }, []);
  return snapshot;
}
