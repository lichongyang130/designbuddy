/**
 * Model registry, parameter mapping, error taxonomy and usage accounting.
 *
 * The platform speaks the OpenAI-compatible protocol. Everything in this file
 * therefore describes what is really sent on the wire, and it never claims a
 * capability it has not verified: a model is only marked as verified when the
 * provider's own model list answered.
 */
export type ProviderId = "openai" | "openrouter" | "deepseek" | "groq" | "mistral" | "google";

export type PlatformModelOptions = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  responseFormat?: "text" | "json_object";
};

export type MappedOptions = {
  body: Record<string, unknown>;
  /** Options the provider protocol cannot carry; they are reported, not silently dropped. */
  dropped: string[];
};

export type ProviderErrorKind = "auth" | "rate_limit" | "quota" | "model" | "bad_request" | "server" | "network" | "unknown";

export type ProviderError = { kind: ProviderErrorKind; message: string; status: number | null };

export type ModelDescriptor = {
  id: string;
  label: string;
  provider: ProviderId;
  /** The context window the provider itself reported; null while it is unknown. */
  contextWindow: number | null;
  /** Whether the provider's default model accepts image input; null while it is unknown. */
  acceptsImages: boolean | null;
  /** True only after the provider's own /models endpoint answered with this id. */
  verified: boolean;
};

export const PROVIDER_ENDPOINTS: Record<ProviderId, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
  groq: "https://groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
};

export const PROVIDER_DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  deepseek: "deepseek-chat",
  groq: "llama-3.3-70b-versatile",
  mistral: "mistral-small-latest",
  google: "gemini-2.5-flash",
};

/** The wire protocol the platform actually speaks today. */
export const PROTOCOL = "openai-compatible";

/**
 * The options the platform supports and the field names the OpenAI-compatible
 * protocol uses. A field that a provider does not accept is dropped on purpose
 * and reported in `dropped` so the caller can say so out loud.
 */
export const OPTION_FIELDS: Record<keyof PlatformModelOptions, string> = {
  temperature: "temperature",
  maxTokens: "max_tokens",
  topP: "top_p",
  responseFormat: "response_format",
};

/** Map platform options onto the wire body of the implemented protocol. */
export function mapModelOptions(options: PlatformModelOptions, supported: (keyof PlatformModelOptions)[] = ["temperature", "maxTokens", "topP", "responseFormat"]): MappedOptions {
  const body: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const key of Object.keys(OPTION_FIELDS) as (keyof PlatformModelOptions)[]) {
    const value = options[key];
    if (value === undefined) continue;
    if (!supported.includes(key)) {
      dropped.push(key);
      continue;
    }
    if (key === "temperature" && (typeof value !== "number" || value < 0 || value > 2)) { dropped.push(key); continue; }
    if (key === "maxTokens" && (typeof value !== "number" || value < 1 || value > 128_000)) { dropped.push(key); continue; }
    if (key === "topP" && (typeof value !== "number" || value <= 0 || value > 1)) { dropped.push(key); continue; }
    if (key === "responseFormat" && value !== "json_object") { dropped.push(key); continue; }
    body[OPTION_FIELDS[key]] = value;
  }
  return { body, dropped };
}

/** Turn a provider failure into an explicit, actionable message. */
export function classifyProviderError(status: number | null, raw: string): ProviderError {
  const detail = raw.slice(0, 300);
  if (status === 401 || status === 403) return { kind: "auth", status, message: "模型服务拒绝了这次调用：凭据无效或没有该模型的权限。请在服务端更新 AI_API_KEY 或改用有权限的模型。" };
  if (status === 429) return { kind: "rate_limit", status, message: "模型服务触发了限流。请降低并发或稍后重试；配额不足时请检查服务商账户。" };
  if (status === 402) return { kind: "quota", status, message: "模型服务返回余额或配额不足，未产生任何内容。请检查服务商账户后再试。" };
  if (status === 404) return { kind: "model", status, message: "模型服务没有找到这个模型标识。请确认模型名称与服务商可用列表一致。" };
  if (status === 400) return { kind: "bad_request", status, message: `模型服务拒绝了这次请求的写法：${detail || "参数不被接受"}` };
  if (status !== null && status >= 500) return { kind: "server", status, message: `模型服务自身出错（HTTP ${status}），本次没有拿到结果。可以重试，仍失败就换模型或联系服务商。` };
  if (status === null) return { kind: "network", status, message: `没有连上模型服务：${detail || "网络错误"}` };
  return { kind: "unknown", status, message: `模型服务返回了未预期的结果（HTTP ${status}）：${detail}` };
}

/** Find the provider a base URL belongs to; "custom" for self-hosted endpoints. */
export function providerForBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  for (const [id, endpoint] of Object.entries(PROVIDER_ENDPOINTS)) {
    if (endpoint.replace(/\/+$/, "") === normalized) return id;
  }
  return "custom";
}

/** The models the platform registers per provider. `verified` stays false until the provider answers. */
export function modelCatalog(): ModelDescriptor[] {
  return (Object.keys(PROVIDER_ENDPOINTS) as ProviderId[]).map((provider) => ({
    id: PROVIDER_DEFAULT_MODELS[provider],
    label: PROVIDER_DEFAULT_MODELS[provider],
    provider,
    // Unknown until the provider answers: the platform does not invent numbers.
    contextWindow: null,
    acceptsImages: null,
    verified: false,
  }));
}

/** Ask the provider which models it actually offers. Requires a key. */
export async function fetchProviderModels(
  baseUrl: string,
  apiKey: string,
  timeoutMs = 15_000,
  fetcher: typeof fetch = fetch,
): Promise<{ ids: string[]; details: Record<string, { contextWindow: number | null }>; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(baseUrl.replace(/\/+$/, "") + "/models", {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
    });
    if (!response.ok) return { ids: [], details: {}, error: classifyProviderError(response.status, await response.text().catch(() => "")).message };
    const payload = (await response.json()) as { data?: Array<{ id?: string; context_length?: number; context_window?: number }> };
    const ids = Array.isArray(payload.data) ? payload.data.map((item) => String(item.id || "")).filter(Boolean) : [];
    const details: Record<string, { contextWindow: number | null }> = {};
    for (const item of Array.isArray(payload.data) ? payload.data : []) {
      const id = String(item?.id || "");
      if (!id) continue;
      const reported = item.context_length ?? item.context_window;
      details[id] = { contextWindow: typeof reported === "number" && Number.isFinite(reported) ? reported : null };
    }
    return { ids, details };
  } catch (error) {
    return { ids: [], details: {}, error: classifyProviderError(null, error instanceof Error ? error.message : "网络错误").message };
  } finally {
    clearTimeout(timer);
  }
}

export type QuotaProbe = {
  provider: string;
  /** Whether the provider exposes a quota endpoint the platform knows. */
  supported: boolean;
  balance: string | null;
  unit: string | null;
  detail: string;
  error?: string;
};

/**
 * The quota endpoints the platform knows about. They are provider specific and
 * are not part of the OpenAI-compatible chat protocol, so the probe uses the
 * provider's own address and never a client supplied one.
 */
const QUOTA_ENDPOINTS: Record<string, { url: string; parse(payload: unknown): { balance: string; unit: string } | null }> = {
  openai: {
    url: "https://api.openai.com/v1/dashboard/billing/credit_grants",
    parse: (payload) => {
      const value = (payload as { total_granted?: number; total_used?: number } | null) ?? {};
      if (typeof value.total_granted !== "number") return null;
      return { balance: (value.total_granted - (value.total_used ?? 0)).toFixed(2), unit: "USD" };
    },
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/credits",
    parse: (payload) => {
      const value = (payload as { data?: { total_credits?: number; total_usage?: number } } | null)?.data;
      if (!value || typeof value.total_credits !== "number") return null;
      return { balance: (value.total_credits - (value.total_usage ?? 0)).toFixed(4), unit: "USD" };
    },
  },
  deepseek: {
    url: "https://api.deepseek.com/user/balance",
    parse: (payload) => {
      const list = (payload as { balance_infos?: Array<{ currency?: string; total_balance?: string }> } | null)?.balance_infos;
      const first = Array.isArray(list) ? list[0] : undefined;
      if (!first || typeof first.total_balance !== "string") return null;
      return { balance: first.total_balance, unit: first.currency || "CNY" };
    },
  },
};

/**
 * Ask a provider for the remaining balance. The probe reports the provider's
 * real answer; when a provider has no known endpoint or refuses the call, the
 * reason is returned instead of an invented number.
 */
export async function fetchProviderQuota(provider: string, apiKey: string, timeoutMs = 15_000): Promise<QuotaProbe> {
  const endpoint = QUOTA_ENDPOINTS[provider];
  if (!endpoint) return { provider, supported: false, balance: null, unit: null, detail: "该服务商没有公开的额度查询接口，平台不会给出估算值。" };
  if (!apiKey) return { provider, supported: true, balance: null, unit: null, detail: "没有配置模型凭据，无法查询额度。", error: "没有配置模型凭据，无法查询额度。" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint.url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
    });
    if (!response.ok) {
      const failure = classifyProviderError(response.status, await response.text().catch(() => ""));
      return { provider, supported: true, balance: null, unit: null, detail: failure.message, error: failure.message };
    }
    const parsed = endpoint.parse(await response.json());
    if (!parsed) return { provider, supported: true, balance: null, unit: null, detail: "服务商返回了无法识别的额度格式，平台不做换算。", error: "服务商返回了无法识别的额度格式。" };
    return { provider, supported: true, balance: parsed.balance, unit: parsed.unit, detail: `服务商返回的剩余额度：${parsed.balance} ${parsed.unit}。` };
  } catch (error) {
    const failure = classifyProviderError(null, error instanceof Error ? error.message : "网络错误");
    return { provider, supported: true, balance: null, unit: null, detail: failure.message, error: failure.message };
  } finally {
    clearTimeout(timer);
  }
}

export type UsageRecord = {
  model: string;
  provider: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  /** False when the provider did not report usage; the numbers stay empty instead of guessed. */
  reported: boolean;
  latencyMs: number;
  status: "succeeded" | "failed";
  error: string;
  createdAt: number;
};

/** Normalize the usage object of an OpenAI-compatible response. */
export function readUsage(payload: unknown): { reported: boolean; promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } {
  const usage = (payload as { usage?: Record<string, unknown> } | null)?.usage;
  if (!usage || typeof usage !== "object") return { reported: false, promptTokens: null, completionTokens: null, totalTokens: null };
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const promptTokens = number(usage.prompt_tokens ?? usage.input_tokens);
  const completionTokens = number(usage.completion_tokens ?? usage.output_tokens);
  const totalTokens = number(usage.total_tokens) ?? (promptTokens !== null || completionTokens !== null ? (promptTokens ?? 0) + (completionTokens ?? 0) : null);
  return { reported: promptTokens !== null || completionTokens !== null, promptTokens, completionTokens, totalTokens };
}
