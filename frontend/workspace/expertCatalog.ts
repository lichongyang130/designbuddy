import { routingExperts, type ExpertProfile } from "../../shared/expertRouting";
import type { Expert } from "./models/workspace";
import type { HomeIconName } from "../../apps/web/src/components/HomeIcon";
import developerAvatar from "../../apps/web/src/assets/experts/anime/developer.webp";
import qaAvatar from "../../apps/web/src/assets/experts/anime/qa.webp";
import documentsAvatar from "../../apps/web/src/assets/experts/anime/documents.webp";
import dataAvatar from "../../apps/web/src/assets/experts/anime/data.webp";
import slidesAvatar from "../../apps/web/src/assets/experts/anime/slides.webp";
import communicationAvatar from "../../apps/web/src/assets/experts/anime/communication.webp";
import brandAvatar from "../../apps/web/src/assets/experts/anime/brand.webp";
import visualAvatar from "../../apps/web/src/assets/experts/anime/visual.webp";
import product_visualAvatar from "../../apps/web/src/assets/experts/anime/product-visual.webp";
import infographicsAvatar from "../../apps/web/src/assets/experts/anime/infographics.webp";
import productAvatar from "../../apps/web/src/assets/experts/anime/product.webp";
import web_designAvatar from "../../apps/web/src/assets/experts/anime/web-design.webp";

export const expertAreaLabels = { office: "办公提效", design: "设计制作", code: "网页应用" } as const;
export const expertCategories = ["全部专家", "办公提效", "设计制作", "网页应用", "我的专家"];
export interface CatalogExpert extends ExpertProfile {
  category: string;
  mode?: "office" | "design" | "code";
  tags: string[];
  icon: HomeIconName;
  materials: string[];
  deliverables: string[];
  limits: string;
  taskIds: string[];
  avatar?: string;
  createdAt?: string;
  custom?: boolean;
}
const icons: Record<string, HomeIconName> = { documents: "document", meeting: "microphone", weekly: "document", "research-summary": "book", triage: "help", data: "chart", slides: "slides", communication: "assistant", brand: "palette", visual: "palette", "product-visual": "grid", infographics: "chart", product: "grid", "web-design": "code", developer: "code", qa: "shield" };
const avatars: Record<string, string> = {
  "documents": documentsAvatar,
  "data": dataAvatar,
  "slides": slidesAvatar,
  "communication": communicationAvatar,
  "brand": brandAvatar,
  "visual": visualAvatar,
  "product-visual": product_visualAvatar,
  "infographics": infographicsAvatar,
  "product": productAvatar,
  "web-design": web_designAvatar,
  developer: developerAvatar,
  qa: qaAvatar,
};
export const expertCatalog: CatalogExpert[] = routingExperts.map(expert => ({
  ...expert, category: expertAreaLabels[expert.mode], tags: expert.homeCategories, icon: icons[expert.id] || "experts",
  avatar: avatars[expert.id],
}));
export function customExpertCatalog(expert: Expert): CatalogExpert {
  const name = expertCatalog.some(p => p.name === expert.name) ? `${expert.name}（我的）` : expert.name;
  return {
    id: expert.id, name, description: expert.description || "用户自定义专业职责，请先确认所需材料与交付目标。", category: "我的专家", custom: true,
    icon: "experts", createdAt: expert.createdAt, tags: expert.skills.length ? expert.skills : ["自定义职责"],
    method: ["确认目标、材料范围和交付格式", "按用户定义职责组织工作，区分事实与建议", ...expert.capabilities.filter(Boolean).slice(0, 3)],
    checks: ["缺少关键信息先询问，不编造事实与执行结果", "未接入的工具与服务不得声称可用", "核对交付完整性，列出待用户确认事项"],
    materials: ["本次任务的原始材料", "使用对象、目标与限制"], deliverables: ["按职责约定的结果", "待确认事项"],
    limits: "该专家保存在当前浏览器。自定义技能与职责不是已安装工具，也不是官方资质；实际执行依赖可用的模型和服务。", taskIds: [],
  };
}
/** Only closely corresponding legacy URLs resolve to replacements; unrelated retired roles stay unavailable. */
export const expertLegacyIds: Record<string, string> = { "builtin-developer": "developer", "builtin-product": "product" };

/** Public role overrides; disabling removes a role from matching and manual candidates. */
export function configureExpert(expert: CatalogExpert, settings: Record<string, { enabled: boolean; description: string; instructions: string }>): CatalogExpert {
  const config = settings[expert.id];
  if (!config) return expert;
  return { ...expert, description: config.description || expert.description, method: config.instructions ? [config.instructions, ...expert.method.slice(0, 5)] : expert.method };
}
