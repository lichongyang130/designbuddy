import { routingExperts, type ExpertProfile } from "./expertRouting";
import { skillProducts } from "./skillProducts";

/** Capability configuration is versioned separately from model selection. It never grants account permissions. */
export const expertExecutionVersion = "2026.10.20-1";
export const expertProducts: Record<string, string[]> = {
  documents: ["documents"],
  data: ["data"],
  slides: ["presentations"],
  communication: [],
  brand: ["brand"],
  visual: ["visual"],
  "product-visual": ["visual"],
  infographics: ["data", "presentations"],
  product: ["projects"],
  "web-design": ["web"],
  developer: ["web", "quality"],
  meeting: ["documents"],
  weekly: ["documents", "presentations"],
  "research-summary": ["documents", "presentations"],
  triage: ["quality"],
  qa: ["quality"],
};
export const productLeads: Record<string, string> = {
  presentations: "slides",
  documents: "documents",
  data: "data",
  brand: "brand",
  visual: "visual",
  web: "web-design",
  projects: "product",
  quality: "qa",
};
export type ExpertBinding = {
  id: string;
  name: string;
  description: string;
  baseExpertId: string;
  productIds: string[];
  version: number;
};
export type ExecutionExpert = ExpertProfile & {
  configVersion: string;
  baseExpertId: string;
  productIds: string[];
  custom: boolean;
};
export function builtinExecutionExpert(
  id: string,
): ExecutionExpert | undefined {
  const profile = routingExperts.find((e) => e.id === id);
  return profile
    ? {
        id: profile.id,
        name: profile.name,
        description: profile.description,
        method: [...profile.method],
        checks: [...profile.checks],
        configVersion: expertExecutionVersion,
        baseExpertId: id,
        productIds: [...(expertProducts[id] || [])],
        custom: false,
      }
    : undefined;
}
/** Conservative local routing, not an AI call or an execution authorization. Ambiguous consultations remain chat. */
export function deliveryProduct(prompt: string): string | undefined {
  const p = prompt.trim();
  if (
    /^(?:如何|怎么|为什么|解释|讨论|咨询|请问)|只(?:要|需)(?:文字|建议|方案)|不要(?:生成|制作|导出|文件)/i.test(
      p,
    )
  )
    return;
  if (
    !/制作|生成|输出|导出|交付|设计|创建|开发|搭建|做|写|检查|审计|复核|检测|\b(?:create|generate|export|build|audit)\b/i.test(
      p,
    )
  )
    return;
  if (
    /检查|审计|复核|检测|\baudit\b/i.test(p) &&
    /HTML|CSS|JS\b|网页|源码|无障碍/i.test(p)
  )
    return "quality";
  if (/PPTX?|演示文稿|幻灯片|slides|powerpoint/i.test(p))
    return "presentations";
  if (/DOCX|\bWord\b|正式文档|文档文件|可编辑报告/i.test(p)) return "documents";
  if (/品牌(?:规范|系统|资产|视觉)|品牌.*(?:配色|标志)|design tokens/i.test(p))
    return "brand";
  if (/海报|商品主图|营销图片|社媒封面|产品展示图/i.test(p)) return "visual";
  if (/网页|网站|官网|落地页|\bHTML\b|\bwebsite\b/i.test(p)) return "web";
  if (/项目计划|项目方案|需求规格|验收规格/i.test(p)) return "projects";
  if (
    /XLSX|数据报告|表格分析|表格报告|分析.*(?:CSV|表格)|(?:CSV|表格).*分析/i.test(
      p,
    )
  )
    return "data";
}
export type ExpertTaskPlan = {
  id: string;
  taskId: string;
  goal: string;
  productId: string;
  productName: string;
  expert: ExecutionExpert;
  lockedExpert: boolean;
  configVersion: string;
  route: {
    kind: "skill" | "workflow";
    id: string;
    version: string;
    executorExpertId: string;
  };
  steps: {
    title: string;
    skillId?: string;
    expertId?: string;
    ready: boolean;
    reason?: string;
  }[];
  ready: boolean;
  blockers: string[];
  boundary: string;
  approvalDigest: string;
  createdAt: number;
  expiresAt: number;
};
export type ExpertTaskExecution = {
  id: string;
  planId: string;
  taskId: string;
  revision: number;
  parentId?: string;
  inputHash: string;
  filename?: string;
  approvedAt: number;
  state: "dispatching" | "linked" | "dispatch-failed";
  runId?: string;
  kind: "skill" | "workflow";
  error?: string;
};
export function productForExpert(expertId?: string) {
  const id = expertId && expertProducts[expertId]?.[0];
  return skillProducts.find((p) => p.id === id);
}
