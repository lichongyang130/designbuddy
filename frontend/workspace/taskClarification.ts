export interface ClarificationQuestion {
  id: string;
  title: string;
  options: string[];
}
export interface ClarificationAnswer { option: number | null; note: string }
export interface TaskClarification {
  kind: "requirements" | "permission";
  sourceUserId: string;
  questions: ClarificationQuestion[];
  answers: ClarificationAnswer[];
  page: number;
  state: "pending" | "answered" | "cancelled";
}

export function validQuestions(value: unknown): value is ClarificationQuestion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return false;
  const ids = new Set<string>();
  return value.every((q) => {
    if (!q || typeof q.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(q.id) || ids.has(q.id) || typeof q.title !== "string" || !q.title.trim() || q.title.length > 200 || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4 || !q.options.every((s: unknown) => typeof s === "string" && s.trim() && s.length <= 160) || new Set(q.options).size !== q.options.length) return false;
    ids.add(q.id);
    return true;
  });
}

export function validClarification(value: unknown): value is TaskClarification {
  if (!value || typeof value !== "object") return false;
  const c = value as TaskClarification;
  return ["requirements", "permission"].includes(c.kind) && typeof c.sourceUserId === "string" && validQuestions(c.questions) && Number.isInteger(c.page) && c.page >= 0 && c.page < c.questions.length && ["pending", "answered", "cancelled"].includes(c.state) && Array.isArray(c.answers) && c.answers.length === c.questions.length && c.answers.every((a, i) => a && (a.option === null || (Number.isInteger(a.option) && a.option >= 0 && a.option < c.questions[i].options.length)) && typeof a.note === "string" && a.note.length <= 2000);
}

export function makeClarification(sourceUserId: string, questions: ClarificationQuestion[], kind: TaskClarification["kind"] = "requirements"): TaskClarification {
  return { kind, sourceUserId, questions, answers: questions.map(() => ({ option: null, note: "" })), page: 0, state: "pending" };
}
export function answerComplete(c: TaskClarification, i: number): boolean {
  return c.answers[i].option !== null || (c.kind === "requirements" && !!c.answers[i].note.trim());
}
export function clarificationSummary(c: TaskClarification): string {
  return c.questions.map((q, i) => {
    const a = c.answers[i];
    return `${i + 1}. ${q.title}\n${a.option === null ? "" : q.options[a.option]}${a.note.trim() ? `${a.option === null ? "" : "；补充："}${a.note.trim()}` : ""}`;
  }).join("\n\n");
}

const marker = "```designbuddy-clarification";
/** Buffer the structured reply until validated; never display protocol JSON as an answer. */
export function isClarificationStream(content: string): boolean {
  const start = content.trimStart();
  return !!start && (marker.startsWith(start) || start.startsWith(marker));
}
export function parseClarification(content: string): ClarificationQuestion[] | null {
  if (!content.trimStart().startsWith(marker)) return null;
  const match = content.trim().match(/^```designbuddy-clarification\s*\n([\s\S]*?)\n```$/);
  if (!match || content.length > 12_000) throw new Error("确认问题格式无效，请重新生成；没有继续执行任务。");
  let data;
  try { data = JSON.parse(match[1]); } catch { throw new Error("确认问题格式无效，请重新生成；没有继续执行任务。"); }
  if (!data || !validQuestions(data.questions)) throw new Error("确认问题格式无效，请重新生成；没有继续执行任务。");
  return data.questions;
}

/** Conservative local guard for a first, genuinely underspecified UI request, not every task. */
export function initialUIQuestions(text: string): ClarificationQuestion[] | null {
  if (text.length > 120 || !/(?:做|设计|开发|制作|实现|搭建|build|design|create).*(?:\bui\b|界面)|(?:\bui\b|界面).*(?:做|设计|开发|制作|实现|搭建)/i.test(text) || /网页|网站|小程序|移动端|手机|桌面|首页|登录|后台|看板|表单|react|html|vue|web|app|需求|方案|讨论|解释|什么/i.test(text)) return null;
  return [
    { id: "goal", title: "你希望我先帮你完成什么？", options: ["直接设计并实现界面", "优化已有界面", "先梳理需求和交互"] },
    { id: "platform", title: "这个 UI 大概是什么形态？", options: ["网页页面（HTML/React 等）", "微信小程序", "还没定，先聊需求"] },
  ];
}
