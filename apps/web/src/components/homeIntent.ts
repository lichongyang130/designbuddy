import { isPptPrompt } from "../../../../frontend/workspace/pptStore";
import type { HomeMode } from "./homeScenes";

/**
 * Local intent detection for the single-box homepage.
 *
 * Everything here is a pure function over the draft: no network, no model, no
 * storage. The homepage uses it to say "自动识别：办公 · 将生成 PPT" under the
 * input so people never have to pick a mode before typing — and can correct the
 * guess with one click.
 *
 * Explicit choices always win: `App` stops re-inferring the mode once the person
 * has picked one, because silently switching it back is the most annoying form
 * of "smart".
 */

export type Deliverable = "pptx" | "xlsx" | "html" | "image";

export type DeliverableInfo = {
  id: Deliverable;
  /** Chip copy, e.g. 「将生成 PPT」. */
  label: string;
  icon: "slides" | "chart" | "grid" | "palette";
};

export const DELIVERABLES: Record<Deliverable, DeliverableInfo> = {
  pptx: { id: "pptx", label: "将生成 PPT", icon: "slides" },
  xlsx: { id: "xlsx", label: "将生成表格", icon: "chart" },
  html: { id: "html", label: "将生成网页", icon: "grid" },
  image: { id: "image", label: "将生成图片", icon: "palette" },
};

export const MODE_OPTIONS: Array<{ id: HomeMode; label: string; hint: string }> = [
  { id: "office", label: "办公提效", hint: "文档、数据、汇报、邮件" },
  { id: "design", label: "设计制作", hint: "配色、版式、海报、界面" },
  { id: "code", label: "网页应用", hint: "页面、接口、脚本、修 bug" },
];

/** Only look at the start of a long draft; the rest is detail, not intent. */
function head(text: string): string {
  return text.slice(0, 2000);
}

const DELIVERABLE_RULES: Array<{ id: Deliverable; test: (text: string) => boolean }> = [
  // Reuse the one rule that already routes a prompt straight into the PPT flow,
  // so the chip can never promise something different from what happens on send.
  { id: "pptx", test: (text) => isPptPrompt(text) },
  { id: "xlsx", test: (text) => /(表格|xlsx|excel|数据透视|csv|报表|清单整理)/i.test(text) },
  { id: "html", test: (text) => /(网页|落地页|官网|首页改版|h5|html|前端页面|小程序)/i.test(text) },
  { id: "image", test: (text) => /(海报|banner|图片|插画|封面图|头图|logo|视觉稿)/i.test(text) },
];

const DESIGN_RULES = /(配色|字体|版式|视觉|界面|交互|logo|海报|banner|插画|设计规范|组件库|ui\b|ux\b|风格)/i;
const CODE_RULES = /(代码|接口|api\b|前端|后端|仓库|bug|报错|测试|部署|脚本|函数|组件|typescript|javascript|python|react|vue|sql|css|git)/i;

/** The deliverable a draft is asking for, or null when it is just a request. */
export function detectDeliverable(text: string): Deliverable | null {
  const draft = head(text).trim();
  if (!draft) return null;
  return DELIVERABLE_RULES.find((rule) => rule.test(draft))?.id ?? null;
}

/**
 * Which working mode the draft belongs to.
 *
 * Design is checked before code so 「网页设计」 lands in design, while
 * 「网页加个接口」 still lands in code because the code rule matches later words.
 */
export function inferMode(text: string): HomeMode {
  const draft = head(text);
  const design = DESIGN_RULES.exec(draft);
  const code = CODE_RULES.exec(draft);
  if (design && !code) return "design";
  if (code && !design) return "code";
  if (design && code) return (design.index ?? 0) <= (code.index ?? 0) ? "design" : "code";
  return "office";
}

export type HomeIntent = {
  mode: HomeMode;
  deliverable: Deliverable | null;
  deliverableInfo: DeliverableInfo | null;
  /** True when the mode came from the draft rather than the default. */
  inferred: boolean;
};

export function detectIntent(text: string): HomeIntent {
  const mode = inferMode(text);
  const deliverable = detectDeliverable(text);
  return {
    mode,
    deliverable,
    deliverableInfo: deliverable ? DELIVERABLES[deliverable] : null,
    inferred: inferMode(text) !== "office",
  };
}
