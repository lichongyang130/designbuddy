import type { Slide } from "../../apps/web/src/components/scene-demos/Slides";

export interface PptProject {
  id: string;
  title: string;
  prompt: string;
  slides: Slide[];
  frameworkId?: string;
  frameworkName?: string;
  createdAt: string;
  updatedAt: string;
}

const PPT_KEY = "designbuddy.ppt.v1";

function readAll(): PptProject[] {
  try {
    const raw = localStorage.getItem(PPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown) =>
        p &&
        typeof (p as PptProject).id === "string" &&
        Array.isArray((p as PptProject).slides),
    ) as PptProject[];
  } catch {
    return [];
  }
}
function writeAll(list: PptProject[]) {
  localStorage.setItem(PPT_KEY, JSON.stringify(list));
}

export function listPptProjects(): PptProject[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getPptProject(id: string): PptProject | undefined {
  return readAll().find((p) => p.id === id);
}
export function savePptProject(project: PptProject) {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === project.id);
  const next = { ...project, updatedAt: new Date().toISOString() };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeAll(all);
  return next;
}
export function createPptProject(prompt: string, title?: string, slides?: Slide[]): PptProject {
  const now = new Date().toISOString();
  const cleanPrompt = prompt.trim();
  const derivedTitle = (title || cleanPrompt.slice(0, 36) || "未命名演示文稿").replace(/[\r\n\t]+/g, " ");
  const project: PptProject = {
    id: crypto.randomUUID(),
    title: derivedTitle.length > 48 ? derivedTitle.slice(0, 48) + "…" : derivedTitle,
    prompt: cleanPrompt,
    slides: slides || [],
    createdAt: now,
    updatedAt: now,
  };
  writeAll([project, ...readAll()]);
  return project;
}
export function deletePptProject(id: string) {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function isPptPrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // 快捷提示本身就含这些
  const pptKeywords = /(ppt|pptx|幻灯片|演示文稿|汇报|路演|提案|介绍页|总结页|演示|presentation|slides|keynote)/i;
  if (pptKeywords.test(t)) return true;
  if (t.startsWith("请为我的汇报") || t.startsWith("请为我的汇报主题") || t.includes("编排演示文稿") || t.includes("逐页内容和排版")) return true;
  return false;
}

export function extractTopic(prompt: string): string {
  // 去掉快捷语前缀，提取主题
  let topic = prompt
    .replace(/^.*?主题是[：:]\s*/s, "")
    .replace(/^.*?编排演示文稿.*?主题是[：:]\s*/s, "")
    .replace(/^办公提效需求[：:]/, "")
    .replace(/^请为我的汇报.*?主题是[：:]/s, "")
    .trim();
  topic = topic.split("\n")[0].trim().slice(0, 40);
  if (!topic) {
    topic = prompt.slice(0, 40).replace(/\n/g, " ").trim();
  }
  return topic || "精彩汇报";
}

export function buildDefaultSlides(prompt: string, artImage?: string): Slide[] {
  const topic = extractTopic(prompt);
  const clean = prompt.replace(/[\r\n]+/g, " ").slice(0, 180);
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const topicShort = topic.slice(0, 22);
  // 使用与 seedSlides 一致的 Slide 结构，默认给一张可直接导出的小图（浅色占位），避免 exportPptx 加载失败
  const placeholderImage =
    artImage ||
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const mk = (overrides: Partial<Slide> & { id: string; title: string; eyebrow: string; body: string; layout: string }): Slide => ({
    image: placeholderImage,
    focus: 50,
    notes: "",
    ...overrides,
  } as Slide);

  return [
    mk({
      id: "slide-0",
      title: topicShort,
      eyebrow: "PROJECT DECK / 2026",
      body: `${clean}\n聚焦主题，清晰传达核心价值`,
      layout: "cover",
      notes: "封面：用一句话点明本次汇报要解决什么问题，避免堆砌信息。",
    }),
    mk({
      id: "slide-1",
      title: "我们看到了什么",
      eyebrow: "01 / INSIGHT",
      body: `用户需要的不是更多功能\n而是更少打扰。\n围绕「${topicShort}」的真实场景`,
      layout: "cards",
      notes: "用 3 个典型场景说明痛点，保持每卡一句。",
    }),
    mk({
      id: "slide-2",
      title: "我们的解法",
      eyebrow: "02 / SOLUTION",
      body: `聚焦 ${topicShort} 的关键路径\n把复杂流程拆成可执行的 3 步\n让选择有据可依`,
      layout: "split",
      notes: "左文右图：突出价值主张，不要写成产品清单。",
    }),
    mk({
      id: "slide-3",
      title: "数据说话",
      eyebrow: "03 / EVIDENCE",
      body: `第一阶段｜3\n第二阶段｜5\n第三阶段｜7`,
      layout: "chart",
      notes: "柱图演示进度/增长，用真实数据替换示例数值。",
    }),
    mk({
      id: "slide-4",
      title: "如何落地",
      eyebrow: "04 / PLAN",
      body: `W1｜明确范围与素材\nW2｜联调内容与视觉\nW3｜小范围预演并收集反馈\nW4｜正式汇报并沉淀复盘`,
      layout: "timeline",
      notes: "时间线 4 步，每步有负责人+产出。",
    }),
    mk({
      id: "slide-5",
      title: "对比与选择",
      eyebrow: "05 / POSITIONING",
      body: `维度｜我们｜常规做法\n聚焦度｜围绕核心场景｜功能堆砌\n协同｜一次对齐｜多次补会\n呈现｜可直接演示｜需额外整理`,
      layout: "table",
      notes: "表格最多 4 列，保持对比清晰。",
    }),
    mk({
      id: "slide-6",
      title: "下一步行动",
      eyebrow: "06 / NEXT",
      body: `产品：确认 ${topicShort} 的范围与口径\n设计：完成演示稿视觉与素材\n运营：明确发布与跟进计划`,
      layout: "cover",
      notes: `致谢页：留下日期 ${today} 与联系方式，方便会后跟进。`,
    }),
  ];
}
