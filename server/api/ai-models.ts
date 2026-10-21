import { AI_PROVIDER_ENDPOINTS, AI_PROVIDER_MODELS } from "./ai";
import { normalizeOpenAICompatibleBaseUrl, type ResolveModelHost } from "./openai-compatible-endpoint";
import { fetchProviderModels, fetchProviderQuota, modelCatalog, PROTOCOL, providerForBaseUrl, type ModelDescriptor } from "./model-registry";
import type { TaskBackend } from "./task-backend";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * The model registry the browser can read: which models the platform registers,
 * which parameters the implemented protocol can carry, and — only when the
 * caller asks for it and a key exists — what the provider itself reports.
 */
export type AiRegistryDependencies = {
  fetcher?: typeof fetch;
  resolveHost?: ResolveModelHost;
};

export async function handleAiRegistry(
  request: Request,
  ownerId: string,
  tasks: TaskBackend,
  dependencies: AiRegistryDependencies = {},
): Promise<Response> {
  const url = new URL(request.url);
  const fetcher = dependencies.fetcher || fetch;

  if (url.pathname === "/api/ai/test-connection") {
    if (request.method !== "POST") return json({ error: "只支持 POST。" }, 405);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.apiKey !== "string" || !body.apiKey.trim() || body.apiKey.length > 512)
      return json({ ok: false, error: "请输入有效 API Key。" }, 400);
    if (typeof body.modelId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(body.modelId))
      return json({ ok: false, error: "请输入有效模型标识。" }, 400);
    if (typeof body.provider !== "string")
      return json({ ok: false, error: "请选择模型服务商。" }, 400);

    let baseUrl: string;
    try {
      if (body.provider === "custom") {
        baseUrl = await normalizeOpenAICompatibleBaseUrl(body.baseUrl, dependencies.resolveHost);
      } else if (Object.hasOwn(AI_PROVIDER_ENDPOINTS, body.provider)) {
        baseUrl = AI_PROVIDER_ENDPOINTS[body.provider];
      } else {
        return json({ ok: false, error: "请选择支持的模型服务商。" }, 400);
      }
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "接口地址无效。" }, 400);
    }

    const result = await fetchProviderModels(baseUrl, body.apiKey.trim(), 15_000, fetcher);
    if (result.error) return json({ ok: false, error: result.error });
    return json({
      ok: true,
      modelFound: result.ids.includes(body.modelId),
      modelCount: result.ids.length,
    });
  }

  if (request.method !== "GET") return json({ error: "只支持 GET。" }, 405);

  if (url.pathname === "/api/ai/models") {
    const key = (process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
    const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const defaultModel = process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
    const catalog: ModelDescriptor[] = modelCatalog();
    const wantsVerify = url.searchParams.get("verify") === "1";

    let live: { ids: string[]; details?: Record<string, { contextWindow: number | null }>; error?: string } | undefined;
    let note = "目录中的模型是平台登记值，verified 为 false 表示尚未通过服务商模型列表核验。";
    if (wantsVerify) {
      if (!key) {
        live = { ids: [], details: {}, error: "服务端没有配置 AI_API_KEY / OPENAI_API_KEY，无法向服务商核验模型列表；下面只是平台登记值。" };
        note = "未配置凭据：模型列表未经核验。";
      } else {
        live = await fetchProviderModels(baseUrl, key);
        if (live.error) {
          note = "核验失败：模型列表仍以平台登记值为准。";
        } else {
          for (const item of catalog) {
            if (!live.ids.includes(item.id)) continue;
            item.verified = true;
            item.contextWindow = live.details?.[item.id]?.contextWindow ?? null;
          }
          note = "已向服务商核对：verified 为 true 的条目出现在服务商返回的模型列表中。";
        }
      }
    }

    return json({
      protocol: PROTOCOL,
      configured: Boolean(key),
      baseUrl,
      defaultModel,
      catalog,
      live,
      note,
      providers: Object.keys(AI_PROVIDER_ENDPOINTS).map((id) => ({ id, endpoint: AI_PROVIDER_ENDPOINTS[id], defaultModel: AI_PROVIDER_MODELS[id] })),
      supportedOptions: ["temperature", "maxTokens", "topP", "responseFormat"],
    });
  }

  if (url.pathname === "/api/ai/quota") {
    const key = (process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
    const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const provider = providerForBaseUrl(baseUrl);
    if (!key) {
      return json({
        provider,
        supported: provider === "openai" || provider === "openrouter" || provider === "deepseek",
        balance: null,
        unit: null,
        detail: "服务端没有配置 AI_API_KEY / OPENAI_API_KEY，无法查询额度；平台不会给出估算值。",
        error: "没有配置模型凭据，无法查询额度。",
      });
    }
    return json(await fetchProviderQuota(provider, key));
  }

  if (url.pathname === "/api/ai/usage") {
    const usage = tasks.listAiUsage(ownerId);
    const totals = usage.reduce(
      (acc, row) => {
        acc.calls += 1;
        if (row.status === "failed") acc.failedCalls += 1;
        if (row.reported) {
          acc.reportedCalls += 1;
          acc.promptTokens += row.promptTokens ?? 0;
          acc.completionTokens += row.completionTokens ?? 0;
          acc.totalTokens += row.totalTokens ?? 0;
        }
        return acc;
      },
      { calls: 0, failedCalls: 0, reportedCalls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    );
    return json({
      usage,
      totals,
      note: totals.reportedCalls < totals.calls
        ? "部分调用没有返回用量数据，token 合计只统计服务商明确回报的调用，未回报的不会被估算。"
        : "token 合计来自服务商回报的真实用量。",
    });
  }

  return json({ error: "未找到该接口。" }, 404);
}
