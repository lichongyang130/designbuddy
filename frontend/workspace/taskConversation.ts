import { recordTaskNotifications } from "./notifications";
import { fetchTasks, saveTask } from "./api/tasks";
import { validClarification, type TaskClarification } from "./taskClarification";
import type { ThinkingStep } from "./TaskThinkingProcess";

export type TaskReplyStatus = "waiting" | "streaming" | "complete" | "error" | "stopped" | "local" | "clarifying";
export interface TaskMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  requestContent?: string;
  createdAt: string;
  status: TaskReplyStatus;
  elapsedMs?: number;
  model?: string;
  error?: string;
  feedback?: "up" | "down";
  artifact?: boolean;
  clarification?: TaskClarification;
  requirementsConfirmed?: boolean;
  replyMode?: "chat" | "generation";
  thinkingSteps?: ThinkingStep[];
}
export interface TaskConversation {
  projectId: string;
  mode: "office" | "code" | "design";
  model: string;
  permission: string;
  workflow?: "chat" | "skills";
  skillExpertId?: string;
  suggestedSkillId?: string;
  messages: TaskMessage[];
}
const key = (id: string) => `designbuddy.conversation.v1.${id}`;
export const pendingTaskKey = (id: string) => `designbuddy.conversation.pending.${id}`;

export function loadTaskConversation(id: string): TaskConversation | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(id)) || "null") as TaskConversation | null;
    if (!value || value.projectId !== id || !["office", "code", "design"].includes(value.mode) || !Array.isArray(value.messages) || typeof value.model !== "string" || typeof value.permission !== "string") return null;
    if (!value.messages.every((item) => item && typeof item.id === "string" && ["user", "assistant"].includes(item.role) && typeof item.content === "string" && typeof item.createdAt === "string" && ["waiting", "streaming", "complete", "error", "stopped", "local", "clarifying"].includes(item.status))) return null;
    return { ...value, workflow: value.workflow === "skills" ? "skills" : "chat", skillExpertId: typeof value.skillExpertId === "string" && value.skillExpertId.length <= 80 ? value.skillExpertId : undefined, messages: value.messages.map((item, index) => {
      const valid = validClarification(item.clarification) && value.messages.slice(0, index).some((m) => m.id === item.clarification!.sourceUserId && m.role === "user");
      if ((item.clarification || item.status === "clarifying") && !valid) return { ...item, clarification: undefined, status: "error", error: "确认信息已损坏，请重新生成，没有继续执行任务。" };
      return item.status === "waiting" || item.status === "streaming" ? { ...item, status: "stopped", error: "上次回复已中断，可重新生成。" } : item;
    }) };
  } catch { return null; }
}

export function saveTaskConversation(task: TaskConversation): void {
  const previous = loadTaskConversation(task.projectId);
  localStorage.setItem(key(task.projectId), JSON.stringify(task));
  recordTaskNotifications(task, previous);
  // The same conversation is stored on the server so a refresh, another browser
  // or another device can continue the same task.
  void saveTask({
    id: `conv-${task.projectId}`.slice(0, 80),
    projectId: task.projectId,
    kind: "conversation",
    title: task.messages.find((m) => m.role === "user")?.content.slice(0, 60) || "任务对话",
    status: task.messages.some((m) => m.status === "error") ? "failed" : "succeeded",
    payload: JSON.stringify(task),
    summary: `${task.messages.length} 条消息`,
  }).catch(() => undefined);
}

/** Store a conversation that came from the server into the local mirror. */
export function applyServerConversation(conversation: TaskConversation): TaskConversation {
  localStorage.setItem(key(conversation.projectId), JSON.stringify(conversation));
  return conversation;
}

/** Read the server copy of a conversation. Returns null when the server has none. */
export async function loadServerConversation(projectId: string): Promise<TaskConversation | null> {
  const tasks = await fetchTasks(projectId);
  const record = tasks.find((item) => item.kind === "conversation" && item.projectId === projectId);
  if (!record) return null;
  try {
    const value = JSON.parse(record.payload) as TaskConversation;
    if (!value || value.projectId !== projectId || !Array.isArray(value.messages)) return null;
    return value;
  } catch { return null; }
}
export function projectTaskPath(id: string): string {
  return `${loadTaskConversation(id) ? "/tasks/" : "/editor/"}${encodeURIComponent(id)}`;
}
