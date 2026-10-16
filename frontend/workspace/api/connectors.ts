import type { Connector } from "../models/workspace";
import { apiFetch } from "../../../apps/web/src/api/client";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Connector API failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function listConnectors(signal?: AbortSignal): Promise<Connector[]> {
  const result = await request<unknown>("/connectors", { signal });
  const providers = ["google", "microsoft", "notion", "github", "custom"];
  const statuses = ["disconnected", "pending", "connected", "error"];
  if (!Array.isArray(result) || !result.every((item) => item && typeof item === "object"
    && typeof item.id === "string" && typeof item.name === "string" && typeof item.description === "string"
    && providers.includes(item.provider) && statuses.includes(item.status)
    && Array.isArray(item.scopes) && item.scopes.every((scope: unknown) => typeof scope === "string"))) {
    throw new Error("连接器接口返回了无效的状态数据，无法确认连接。");
  }
  // Copy only public status metadata; never persist unknown response fields or tokens.
  return result.map((item) => ({ id: item.id, name: item.name, description: item.description,
    provider: item.provider, status: item.status, scopes: item.scopes,
    ...(typeof item.connectedAt === "string" ? { connectedAt: item.connectedAt } : {}),
  }));
}

/** Backend should return a provider-hosted authorization URL; never handle provider secrets in the browser. */
export function beginConnectorOAuth(provider: Connector["provider"], returnTo = window.location.href): Promise<{ authorizationUrl: string }> {
  return request<{ authorizationUrl: string }>("/connectors/oauth/start", {
    method: "POST",
    body: JSON.stringify({ provider, returnTo }),
  });
}

export function disconnectConnector(id: string): Promise<void> {
  return request<void>(`/connectors/${encodeURIComponent(id)}/disconnect`, { method: "POST" });
}
