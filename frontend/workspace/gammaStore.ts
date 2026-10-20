/**
 * Gamma 级统一模型：演示/文档/网页 三形态共用
 * - 复用 pptStore 的 localStorage 版本/分享思路
 * - 存储键独立，避免与现有 ppt 数据冲突
 */
import type { Slide } from "../../apps/web/src/components/scene-demos/Slides";
import type { PptSlideSource } from "./pptStore";

// 复用 PptSlideSource，避免重复定义
export type GammaCardKind =
  | "cover"
  | "text"
  | "bullets"
  | "cards"
  | "split"
  | "chart"
  | "table"
  | "timeline"
  | "image"
  | "embed"
  | "cta";

export type GammaCard = Slide & {
  kind: GammaCardKind;
  sources?: PptSlideSource[];
  dataAssetId?: string;
  metric?: string;
  hint?: string;
  props?: Record<string, unknown>;
};

export type GammaDocKind = "presentation" | "document" | "webpage";

export interface GammaDoc {
  id: string;
  title: string;
  prompt: string;
  kind: GammaDocKind;
  cards: GammaCard[];
  themeId?: string;
  themeName?: string;
  frameworkId?: string; // 兼容 pptFrameworks
  frameworkName?: string;
  workspaceId?: string;
  workspaceName?: string;
  createdAt: string;
  updatedAt: string;
}

const GAMMA_KEY = "designbuddy.gamma.v1";
const GAMMA_VERSIONS_KEY = "designbuddy.gamma.versions.v1";

function readAll(): GammaDoc[] {
  try {
    const raw = localStorage.getItem(GAMMA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown) => p && typeof (p as GammaDoc).id === "string" && Array.isArray((p as GammaDoc).cards),
    ) as GammaDoc[];
  } catch {
    return [];
  }
}
function writeAll(list: GammaDoc[]) {
  localStorage.setItem(GAMMA_KEY, JSON.stringify(list));
}

export function listGammaDocs(): GammaDoc[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getGammaDoc(id: string): GammaDoc | undefined {
  return readAll().find((p) => p.id === id);
}
export function saveGammaDoc(doc: GammaDoc) {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === doc.id);
  const next = { ...doc, updatedAt: new Date().toISOString() } as GammaDoc;
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeAll(all);
  try {
    saveGammaVersionSnapshot(doc.id, doc.cards, doc.title, "自动保存");
  } catch {
    // ignore
  }
  return next;
}
export function createGammaDoc(
  prompt: string,
  kind: GammaDocKind = "presentation",
  title?: string,
  cards?: GammaCard[],
  workspace?: { id: string; name: string },
  framework?: { id: string; name: string },
): GammaDoc {
  const now = new Date().toISOString();
  const cleanPrompt = prompt.trim();
  const derivedTitle = (title || cleanPrompt.slice(0, 36) || "未命名 Gamma").replace(/[\r\n\t]+/g, " ");
  const doc: GammaDoc = {
    id: crypto.randomUUID(),
    title: derivedTitle.length > 48 ? derivedTitle.slice(0, 48) + "…" : derivedTitle,
    prompt: cleanPrompt,
    kind,
    cards: (cards || []) as GammaCard[],
    frameworkId: framework?.id,
    frameworkName: framework?.name,
    themeId: framework?.id,
    themeName: framework?.name,
    workspaceId: workspace?.id,
    workspaceName: workspace?.name,
    createdAt: now,
    updatedAt: now,
  };
  writeAll([doc, ...readAll()]);
  if (cards && cards.length) saveGammaVersionSnapshot(doc.id, doc.cards, doc.title, "创建");
  return doc;
}
export function deleteGammaDoc(id: string) {
  writeAll(readAll().filter((p) => p.id !== id));
  try {
    const map = readVersionsMap();
    delete map[id];
    localStorage.setItem(GAMMA_VERSIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
export function updateGammaWorkspace(id: string, workspace: { id: string; name: string } | null): GammaDoc | undefined {
  const doc = getGammaDoc(id);
  if (!doc) return;
  return saveGammaDoc({ ...doc, workspaceId: workspace?.id, workspaceName: workspace?.name });
}

// --- versions ---
export type GammaVersion = {
  id: string;
  gammaId: string;
  title: string;
  cards: GammaCard[];
  label: string;
  createdAt: number;
};
function readVersionsMap(): Record<string, GammaVersion[]> {
  try {
    const raw = localStorage.getItem(GAMMA_VERSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, GammaVersion[]> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v as GammaVersion[];
    }
    return out;
  } catch {
    return {};
  }
}
function writeVersionsMap(map: Record<string, GammaVersion[]>) {
  localStorage.setItem(GAMMA_VERSIONS_KEY, JSON.stringify(map));
}
export function saveGammaVersionSnapshot(gammaId: string, cards: GammaCard[], title: string, label = "手动保存") {
  const map = readVersionsMap();
  const list = map[gammaId] || [];
  const last = list[0];
  const hash = JSON.stringify(cards).slice(0, 2000);
  const lastHash = last ? JSON.stringify(last.cards).slice(0, 2000) : "";
  if (last && hash === lastHash && label === "自动保存") return;
  const version: GammaVersion = {
    id: crypto.randomUUID(),
    gammaId,
    title,
    cards: JSON.parse(JSON.stringify(cards)) as GammaCard[],
    label,
    createdAt: Date.now(),
  };
  const next = [version, ...list].slice(0, 20);
  map[gammaId] = next;
  writeVersionsMap(map);
  return version;
}
export function listGammaVersions(gammaId: string): GammaVersion[] {
  return readVersionsMap()[gammaId] || [];
}
export function restoreGammaVersion(gammaId: string, versionId: string): GammaDoc | undefined {
  const map = readVersionsMap();
  const list = map[gammaId] || [];
  const v = list.find((x) => x.id === versionId);
  if (!v) return;
  const doc = getGammaDoc(gammaId);
  if (!doc) return;
  const restored: GammaDoc = { ...doc, cards: JSON.parse(JSON.stringify(v.cards)) as GammaCard[], title: v.title, updatedAt: new Date().toISOString() };
  saveGammaDoc(restored);
  saveGammaVersionSnapshot(gammaId, restored.cards, restored.title, `恢复 ${v.label}`);
  return restored;
}

// --- prompt 分类：复用 ppt 但扩到 document/webpage ---
export function classifyGammaKind(text: string): GammaDocKind {
  const t = text.trim();
  if (/(网页|网站|落地页|官网|h5|webpage|site)/i.test(t)) return "webpage";
  if (/(文档|doc|手记|说明|报告|memo|note)/i.test(t)) return "document";
  if (/(ppt|pptx|幻灯片|演示文稿|汇报|路演|提案|演示|presentation|slides|keynote)/i.test(t)) return "presentation";
  // 默认演示，保持现有用户习惯
  return "presentation";
}
export function isGammaPrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // 覆盖 ppt 关键词 + 文档/网页关键词
  if (/(ppt|pptx|幻灯片|演示文稿|汇报|路演|提案|文档|网页|网站|落地页|presentation|slides|keynote|document|webpage)/i.test(t)) return true;
  return false;
}

// --- 分享 ---
export function encodeGammaShare(doc: GammaDoc): string {
  try {
    const payload = JSON.stringify({ title: doc.title, prompt: doc.prompt, kind: doc.kind, cards: doc.cards, framework: doc.frameworkId, workspace: doc.workspaceId });
    const b64 = btoa(unescape(encodeURIComponent(payload)));
    return `${window.location.origin}${window.location.pathname}#gamma-share=${encodeURIComponent(b64)}`;
  } catch {
    return window.location.href;
  }
}
export function decodeGammaShare(b64: string): GammaDoc | null {
  try {
    const decoded = decodeURIComponent(escape(atob(decodeURIComponent(b64))));
    const obj = JSON.parse(decoded) as Partial<GammaDoc> & { cards?: GammaCard[]; framework?: string; workspace?: string };
    if (!Array.isArray(obj.cards) || !obj.cards.length) return null;
    return {
      id: "shared-" + Math.random().toString(36).slice(2, 8),
      title: String(obj.title || "分享的 Gamma").slice(0, 48),
      prompt: String(obj.prompt || "").slice(0, 2000),
      kind: (obj.kind as GammaDocKind) || "presentation",
      cards: obj.cards as GammaCard[],
      frameworkId: (obj as Record<string, unknown>).frameworkId as string || obj.framework,
      frameworkName: obj.frameworkName,
      themeId: (obj as Record<string, unknown>).frameworkId as string || obj.framework,
      workspaceId: obj.workspaceId || obj.workspace,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as GammaDoc;
  } catch {
    return null;
  }
}
