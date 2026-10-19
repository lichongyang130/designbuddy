/** Versioned, declarative visual choices only. Never executable drawing code or arbitrary coordinates. */
export const presentationLayoutCatalog = [
  { id: "editorial-cover", type: "cover", label: "结论封面" },
  { id: "executive-summary", type: "bullets", label: "执行摘要" },
  { id: "decision-matrix", type: "table", label: "方案比较矩阵" },
  { id: "capability-boundary", type: "comparison", label: "能力边界对照" },
  { id: "kpi-insight", type: "metrics", label: "指标与口径" },
  { id: "chart-takeaway", type: "chart", label: "图表与结论" },
  { id: "chart-ledger", type: "chart", label: "图表与明细" },
  { id: "adaptive-table", type: "table", label: "自适应表格" },
  { id: "risk-response", type: "table", label: "风险与应对" },
  { id: "stage-gates", type: "timeline", label: "阶段关卡" },
  { id: "evidence-spotlight", type: "quote", label: "原文证据聚焦" },
  { id: "action-agenda", type: "bullets", label: "行动与决策清单" },
  { id: "visual-cover", type: "cover", label: "主视觉封面" },
  { id: "visual-story", type: "bullets", label: "图文叙事" },
  { id: "screenshot-evidence", type: "bullets", label: "截图与原生说明" },
  { id: "message-focus", type: "bullets", label: "主张与支撑" },
  { id: "native-structure", type: "bullets", label: "原生并列结构" },
  { id: "native-process", type: "bullets", label: "有依据的顺序流程" },
  { id: "decision-criteria", type: "bullets", label: "待核对决策条件" },
  { id: "connected-gates", type: "timeline", label: "原生连接关卡" },
] as const;
export type PresentationLayoutId =
  (typeof presentationLayoutCatalog)[number]["id"];
export type PresentationDesign = {
  layout: PresentationLayoutId | "auto";
  nature: "fact" | "analysis" | "recommendation" | "pending";
  takeaway?: string;
  /** Zero-based data-row indices; changes styling only, never filters or reorders data. */
  emphasisRows?: number[];
  /** Compiler-resolved director metadata, not accepted as a model design override. */
  directed?: {
    role: import("./presentationDirection").DirectionPage["role"];
    pace: import("./presentationDirection").DirectionPage["pace"];
    focusIndex?: number;
    sequenceBasis?: "proposal" | "source";
  };
  visual?: { assetId: string; fit: "contain" | "cover" };
};
export const presentationLayoutEngineVersion = "adaptive-2.0.0";

export const presentationVisualStyles = [
  {
    id: "consulting",
    label: "咨询极简",
    composition: "结论先行 / 右侧主视觉 / 克制留白",
  },
  {
    id: "technology-launch",
    label: "科技发布",
    composition: "深色舞台 / 大图出界 / 明确视觉焦点",
  },
  {
    id: "brand-editorial",
    label: "品牌图文",
    composition: "暖色杂志 / 左图右文 / 章节节奏",
  },
] as const;
export type PresentationVisualStyle =
  (typeof presentationVisualStyles)[number]["id"];

export const presentationVisualEngineVersion = "visual-1.0.0";
