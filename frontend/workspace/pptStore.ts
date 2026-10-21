import type { Slide } from "../../apps/web/src/components/scene-demos/Slides";
import { PRESET_THEMES, useThemeStore } from "./themeStore";

export type PptSlideSource = { label: string; url: string };
export type PptSlide = Slide & {
  sources?: PptSlideSource[];
  dataAssetId?: string;
  metric?: string;
  hint?: string;
};

export interface PptProject {
  id: string;
  title: string;
  prompt: string;
  slides: PptSlide[];
  frameworkId?: string;
  frameworkName?: string;
  /** The deck's visual theme (see shared/deckTheme.ts). Absent on decks created before themes existed. */
  themeId?: string;
  themeName?: string;
  workspaceId?: string;
  workspaceName?: string;
  createdAt: string;
  updatedAt: string;
}

const PPT_KEY = "designbuddy.ppt.v1";
const PPT_VERSIONS_KEY = "designbuddy.ppt.versions.v1";

function normalizeProject(p: PptProject): PptProject {
  // migrate legacy string[] sources to {label,url} objects
  if (Array.isArray(p.slides)) {
    for (const s of p.slides as unknown as Record<string, unknown>[]) {
      if (Array.isArray(s.sources)) {
        const first = (s.sources as unknown[])[0];
        if (typeof first === "string") {
          s.sources = (s.sources as unknown as string[]).map((u) => ({ label: u.slice(0, 40) || "引用", url: u }));
        }
      }
    }
  }
  return p;
}

function readAll(): PptProject[] {
  try {
    const raw = localStorage.getItem(PPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed.filter(
      (p: unknown) =>
        p &&
        typeof (p as PptProject).id === "string" &&
        Array.isArray((p as PptProject).slides),
    ) as PptProject[]).map(normalizeProject);
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
  const next = { ...project, updatedAt: new Date().toISOString() } as PptProject;
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeAll(all);
  // auto snapshot version on save (debounced via caller, but also keep last 20)
  try {
    savePptVersionSnapshot(project.id, project.slides, project.title, "自动保存");
  } catch { /* ignore */ }
  return next;
}
/** The theme a brand-new deck starts with: the user's default, else the first preset. */
function defaultDeckTheme(): { id: string; name: string } | undefined {
  const preferred = useThemeStore.getState().defaultThemeId;
  const theme = PRESET_THEMES.find((item) => item.id === preferred) ?? PRESET_THEMES[0];
  return theme ? { id: theme.id, name: theme.name } : undefined;
}

export function createPptProject(
  prompt: string,
  title?: string,
  slides?: PptSlide[],
  workspace?: { id: string; name: string },
  framework?: { id: string; name: string },
  theme?: { id: string; name: string },
): PptProject {
  const now = new Date().toISOString();
  const deckTheme = theme ?? defaultDeckTheme();
  const cleanPrompt = prompt.trim();
  const derivedTitle = (title || cleanPrompt.slice(0, 36) || "未命名演示文稿").replace(/[\r\n\t]+/g, " ");
  const project: PptProject = {
    id: crypto.randomUUID(),
    title: derivedTitle.length > 48 ? derivedTitle.slice(0, 48) + "…" : derivedTitle,
    prompt: cleanPrompt,
    slides: (slides || []) as PptSlide[],
    frameworkId: framework?.id,
    frameworkName: framework?.name,
    themeId: deckTheme?.id,
    themeName: deckTheme?.name,
    workspaceId: workspace?.id,
    workspaceName: workspace?.name,
    createdAt: now,
    updatedAt: now,
  };
  writeAll([project, ...readAll()]);
  if (slides && slides.length) {
    savePptVersionSnapshot(project.id, project.slides, project.title, "创建");
  }
  return project;
}
export function deletePptProject(id: string) {
  writeAll(readAll().filter((p) => p.id !== id));
  // clean versions
  try {
    const map = readVersionsMap();
    delete map[id];
    localStorage.setItem(PPT_VERSIONS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function updatePptProjectWorkspace(id: string, workspace: { id: string; name: string } | null): PptProject | undefined {
  const p = getPptProject(id);
  if (!p) return;
  const next = savePptProject({
    ...p,
    workspaceId: workspace?.id,
    workspaceName: workspace?.name,
  });
  return next;
}

// --- versions (local, like ProjectEditor but for PPT) ---
export type PptVersion = {
  id: string;
  pptId: string;
  title: string;
  slides: PptSlide[];
  label: string;
  createdAt: number;
};

function readVersionsMap(): Record<string, PptVersion[]> {
  try {
    const raw = localStorage.getItem(PPT_VERSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, PptVersion[]> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v as PptVersion[];
    }
    return out;
  } catch {
    return {};
  }
}
function writeVersionsMap(map: Record<string, PptVersion[]>) {
  localStorage.setItem(PPT_VERSIONS_KEY, JSON.stringify(map));
}
export function savePptVersionSnapshot(pptId: string, slides: PptSlide[], title: string, label = "手动保存") {
  const map = readVersionsMap();
  const list = map[pptId] || [];
  // avoid duplicate if slides identical to last
  const last = list[0];
  const hash = JSON.stringify(slides).slice(0, 2000);
  const lastHash = last ? JSON.stringify(last.slides).slice(0, 2000) : "";
  if (last && hash === lastHash && label === "自动保存") return;
  const version: PptVersion = {
    id: crypto.randomUUID(),
    pptId,
    title,
    slides: JSON.parse(JSON.stringify(slides)) as PptSlide[],
    label,
    createdAt: Date.now(),
  };
  const next = [version, ...list].slice(0, 20);
  map[pptId] = next;
  writeVersionsMap(map);
  return version;
}
export function listPptVersions(pptId: string): PptVersion[] {
  return readVersionsMap()[pptId] || [];
}
export function restorePptVersion(pptId: string, versionId: string): PptProject | undefined {
  const map = readVersionsMap();
  const list = map[pptId] || [];
  const v = list.find((x) => x.id === versionId);
  if (!v) return;
  const p = getPptProject(pptId);
  if (!p) return;
  const restored: PptProject = { ...p, slides: JSON.parse(JSON.stringify(v.slides)) as PptSlide[], title: v.title, updatedAt: new Date().toISOString() };
  // save as new version
  savePptProject(restored);
  savePptVersionSnapshot(pptId, restored.slides, restored.title, `恢复 ${v.label}`);
  return restored;
}

// --- prompt helpers ---
export function isPptPrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const pptKeywords = /(ppt|pptx|幻灯片|演示文稿|汇报|路演|提案|介绍页|总结页|演示|presentation|slides|keynote)/i;
  if (pptKeywords.test(t)) return true;
  if (t.startsWith("请为我的汇报") || t.startsWith("请为我的汇报主题") || t.includes("编排演示文稿") || t.includes("逐页内容和排版")) return true;
  return false;
}

export function extractTopic(prompt: string): string {
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

export function buildDefaultSlides(prompt: string, artImage?: string): PptSlide[] {
  const topic = extractTopic(prompt);
  const clean = prompt.replace(/[\r\n]+/g, " ").slice(0, 180);
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const topicShort = topic.slice(0, 22);
  const placeholderImage =
    artImage ||
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const mk = (overrides: Partial<PptSlide> & { id: string; title: string; eyebrow: string; body: string; layout: string }): PptSlide => ({
    image: placeholderImage,
    focus: 50,
    notes: "",
    ...overrides,
  } as PptSlide);

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

// Share helper: encode PPT as URL fragment (like DesignProject share)
export function encodePptShare(project: PptProject): string {
  try {
    const payload = JSON.stringify({ title: project.title, prompt: project.prompt, slides: project.slides, framework: project.frameworkId, workspace: project.workspaceId });
    const b64 = btoa(unescape(encodeURIComponent(payload)));
    return `${window.location.origin}${window.location.pathname}#ppt-share=${encodeURIComponent(b64)}`;
  } catch {
    return window.location.href;
  }
}
