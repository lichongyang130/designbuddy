/** A proposal is not an authorization. Only explicit approval may create one run. */
export type SkillFileIdentity = { name: string; size: number; sha256: string };
export type SkillOptions = { deduplicate: boolean; parameters?: Record<string, string> };
export type SkillDecision =
  | { kind: "plan"; expertId: string; skillId: string; reason: string; options: SkillOptions }
  | { kind: "clarify"; question: string; options: string[] }
  | { kind: "unsupported"; reason: string };
export type SkillPlan = {
  id: string; requestId: string; goal: string; file: SkillFileIdentity; expertScope?: string; skillScope?: string[]; taskId?: string;
  createdAt: string; expiresAt: string; status: "planning" | "review" | "clarify" | "unsupported" | "failed" | "cancelled" | "executed";
  decision?: SkillDecision; skillVersion?: string; approvalDigest?: string; runId?: string; error?: string;
};
export type SkillPlanningRequest = {
  requestId: string; goal: string; file: SkillFileIdentity; expertScope?: string; skillScope?: string[]; taskId?: string;
  consent: true; permission?: string; model?: string; provider?: string; apiKey?: string;
};
