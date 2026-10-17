import { apiJSON } from "../../../apps/web/src/api/client";

/** A model the platform registers, as the server reports it. */
export type RegisteredModel = {
  id: string;
  label: string;
  provider: string;
  /** null while the provider has not reported it. */
  contextWindow: number | null;
  /** null while the provider has not confirmed it. */
  acceptsImages: boolean | null;
  /** True only after the provider's own model list confirmed this id. */
  verified: boolean;
};

export type ModelRegistry = {
  protocol: string;
  configured: boolean;
  baseUrl: string;
  defaultModel: string;
  catalog: RegisteredModel[];
  live?: { ids: string[]; error?: string };
  note: string;
  providers: { id: string; endpoint: string; defaultModel: string }[];
  supportedOptions: string[];
};

export type AiUsageRow = {
  id: string;
  model: string;
  provider: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reported: boolean;
  latencyMs: number;
  status: string;
  error: string;
  createdAt: number;
};

export type AiUsageReport = {
  usage: AiUsageRow[];
  totals: {
    calls: number;
    failedCalls: number;
    reportedCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  note: string;
};

export async function fetchModelRegistry(verify = false): Promise<ModelRegistry> {
  return apiJSON<ModelRegistry>(`/ai/models${verify ? "?verify=1" : ""}`);
}

export async function fetchAiUsage(): Promise<AiUsageReport> {
  return apiJSON<AiUsageReport>("/ai/usage");
}

export type QuotaProbe = {
  provider: string;
  supported: boolean;
  balance: string | null;
  unit: string | null;
  detail: string;
  error?: string;
};

export async function fetchAiQuota(): Promise<QuotaProbe> {
  return apiJSON<QuotaProbe>("/ai/quota");
}
