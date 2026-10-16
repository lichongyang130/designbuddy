import { categorySeeds } from "./promptCatalogSeeds.ts";
import type { HomeMode } from "./homeScenes";

export interface PromptTask { id: string; title: string; description: string; prompt: string; mode: HomeMode; category: string; group: string }
export interface PromptGroup { id: string; title: string; tasks: PromptTask[] }
export interface PromptCategory { id: string; title: string; mode: HomeMode; groups: PromptGroup[] }
type GroupSeed = [title: string, brief: string, tasks: string];

const quality = "请先确认任务的使用对象、目的、资料范围和交付格式，优先利用我已经提供的信息，不要重复询问已明确的内容。若关键材料尚未提供，请列出最少且必要的补充问题，等待回答后再开展实质工作，不要用虚构内容填满结果。处理过程中区分原始事实、合理推断和建议，保留可追溯的来源位置；没有证据的结论明确标注待确认，不编造数字、引文、人物、时间或已完成的操作。输出应层次清楚、表达具体、可直接复用，避免空泛口号和重复凑字。最后检查前后口径、遗漏项及边界条件，给出需要我复核的事项和可执行的下一步。";
const modeRules: Record<HomeMode, string> = {
  office: "请用中文完成这项办公任务，先给可用的主体结果，再说明关键处理依据。涉及表格时说明字段含义、数据口径与计算逻辑；涉及文案时确保称谓、时间和表达目的保持一致。只能使用实际可访问的材料与工具，不要声称已读取尚未上传的附件、生成未提供的下载文件或发送任何信息。",
  code: "请围绕现有项目实施，不擅自替换技术栈、删除功能或覆盖无关修改。先说明涉及的文件、接口和依赖，再提供具体实现或最小补丁；考虑输入校验、权限、异常处理和兼容性，附运行命令、测试用例、预期结果与回滚方法。没有执行环境时提供验证步骤，不声称测试已运行或服务已部署。",
  design: "请从目标用户和使用场景出发，形成具有明确视觉方向与交互逻辑的设计方案，而不是只有风格形容词。说明布局层级、文字内容、配色、字体、间距及关键状态，兼顾窄屏、可访问性和实际制作限制。素材来源和授权不明时明确提示；没有图像生成或原生应用运行工具时，只交付方案和制作说明，不冒充已产出图片或已发布应用。",
};
function category(mode: HomeMode, id: string, title: string, groups: GroupSeed[]): PromptCategory {
  return { id, title, mode, groups: groups.map(([name, brief, raw], gi) => ({
    id: `${id}-${gi + 1}`, title: name,
    tasks: raw.split("；").map((entry, i) => {
      const [taskTitle, detail] = entry.split("｜");
      const description = detail || brief;
      const prompt = `请帮我完成「${taskTitle}」，所属任务为「${title} / ${name}」。\n\n任务目标：${description}。\n\n具体要求：${brief}。\n\n工作方式：${modeRules[mode]}\n\n质量与交付要求：${quality}`;
      return { id: `${id}-${gi + 1}-${i + 1}`, title: taskTitle, description, prompt, mode, category: title, group: name };
    }),
  })) };
}

export const promptCategories: PromptCategory[] = categorySeeds.map(([mode, id, title, groups]) => category(mode, id, title, groups));
export const categoriesForMode = (mode: HomeMode) => promptCategories.filter(c => c.mode === mode);
export const allPromptTasks = promptCategories.flatMap(c => c.groups.flatMap(g => g.tasks));
export const chineseCharacterCount = (text: string) => (text.match(/\p{Script=Han}/gu) || []).length;
export type PromptUsage = Record<string, { count: number; lastUsed: number }>;
const storageKey = "designbuddy.prompt-recommendations.v1";
export function readPromptUsage(): PromptUsage {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(allPromptTasks.filter(t => value[t.id] && Number.isFinite(value[t.id].count) && value[t.id].count > 0 && Number.isFinite(value[t.id].lastUsed)).map(t => [t.id, { count: Math.min(value[t.id].count, 1000), lastUsed: value[t.id].lastUsed }]));
  } catch { return {}; }
}
export function recordPromptUse(id: string) {
  const usage = readPromptUsage();
  usage[id] = { count: (usage[id]?.count || 0) + 1, lastUsed: Date.now() };
  try { localStorage.setItem(storageKey, JSON.stringify(usage)); } catch { /* Recommendation history is optional, never block inserting a prompt. */ }
}
function terms(text: string) {
  const values = new Set<string>();
  for (const part of text.toLowerCase().match(/[a-z0-9]{2,}|\p{Script=Han}{2,}/gu) || []) {
    if (/^[a-z0-9]/.test(part)) values.add(part);
    else for (let i = 0; i < part.length - 1; i++) values.add(part.slice(i, i + 2));
  }
  return values;
}
/** Transparent local relevance ranking; never sends the user's draft to an AI service. */
export function recommendPrompts(tasks: PromptTask[], query: string, usage: PromptUsage, seen: string[] = [], lastBatch: string[] = [], size = 3): PromptTask[] {
  const words = terms(query.slice(0, 4000));
  const scored = tasks.map((task, index) => {
    const haystack = `${task.title} ${task.description}`.toLowerCase();
    const matches = [...words].reduce((n, word) => n + (haystack.includes(word) ? 1 : 0), 0);
    return { task, index, score: matches * 5 + Math.min(usage[task.id]?.count || 0, 3) * .5 };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  const fresh = scored.filter(({ task }) => !seen.includes(task.id) && !lastBatch.includes(task.id));
  const remainder = scored.filter(({ task }) => !lastBatch.includes(task.id) && !fresh.some(x => x.task.id === task.id));
  const fallback = scored.filter(({ task }) => lastBatch.includes(task.id));
  // Four-task subgroups use two rows so adjacent batches can remain disjoint.
  const batchSize = Math.min(size, Math.max(1, Math.floor(tasks.length / 2)));
  return [...fresh, ...remainder, ...fallback].slice(0, batchSize).map(x => x.task);
}
