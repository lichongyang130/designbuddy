import { useEffect, useState } from "react";
import type { TaskConversation } from "./taskConversation";

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
export function markNotificationRead(id?: string) {
  write(readNotifications().map((n) => !id || n.id === id ? { ...n, read: true } : n));
}
export function removeNotification(id: string) { write(readNotifications().filter((n) => n.id !== id)); }
export function clearReadNotifications() { write(readNotifications().filter((n) => !n.read)); }

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
  if (message?.role === "assistant" && message.status !== before?.status) {
    const kind = message.status === "error" ? "error" : message.status === "clarifying" ? "action" : message.status === "complete" && !message.clarification ? "complete" : null;
    if (kind) {
      const id = `${task.projectId}:${message.id}:${kind}`;
      const brief = task.messages.find((m) => m.role === "user")?.content.slice(0, 100) || "任务";
      const n: WorkspaceNotification = { id, projectId: task.projectId, messageId: message.id, kind, title: kind === "error" ? "任务回复失败" : kind === "action" ? "任务等待确认" : message.artifact ? "项目文件已生成" : "AI 回复已完成", description: `${brief}${kind === "error" && message.error ? ` · ${message.error.slice(0, 160)}` : ""}`, createdAt: new Date().toISOString(), read: false };
      items = [n, ...items.filter((item) => item.id !== id)];
      changed = true;
    }
  }
  if (changed) write(items);
}

export function useNotifications() {
  const [snapshot, setSnapshot] = useState(() => ({ items: readNotifications(), storageFailed }));
  useEffect(() => {
    const sync = (event: Event) => setSnapshot((event as CustomEvent).detail);
    const storage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        storageFailed = false;
        setSnapshot({ items: readNotifications(), storageFailed });
      }
    };
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", storage);
    setSnapshot({ items: readNotifications(), storageFailed });
    return () => { window.removeEventListener(eventName, sync); window.removeEventListener("storage", storage); };
  }, []);
  return snapshot;
}
