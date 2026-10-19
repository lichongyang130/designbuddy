/** Content-first director contract. No coordinates, provider settings or free drawing commands. */
export const presentationDirectionEngineVersion = "director-1.0.0";
export const directionRoles = {
  opening: "开场",
  evidence: "证据",
  explanation: "解释",
  options: "方案",
  conditions: "条件",
  decision: "决策",
} as const;
export const directionPaces = {
  focus: "重点页",
  explain: "解释页",
  verify: "核对页",
} as const;
export const directionExpressions = {
  statement: "重点主张",
  data: "原生数据",
  contrast: "对照比较",
  parallel: "并列结构",
  sequence: "顺序流程",
  criteria: "决策条件",
} as const;
export type DirectionPage = {
  role: keyof typeof directionRoles;
  pace: keyof typeof directionPaces;
  message: string;
  evidenceRefs: string[];
  expression: keyof typeof directionExpressions;
  reason: string;
  boundary: string;
  focusIndex?: number;
  sequence?: {
    basis: "proposal" | "source";
    sourceRef?: string;
    quote?: string;
  };
};
export type ContentDirection = {
  schemaVersion: 1;
  decision: string;
  argument: string;
  pages: DirectionPage[];
};
export const directorLayoutIds = [
  "message-focus",
  "native-structure",
  "native-process",
  "decision-criteria",
  "connected-gates",
] as const;
