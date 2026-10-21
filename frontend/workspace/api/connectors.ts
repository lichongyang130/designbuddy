import { apiFetch, readJSON } from "../../../apps/web/src/api/client";
import {
  connectorProviders,
  connectorStatuses,
  type ConnectorAuthType,
  type ConnectorField,
  type ConnectorProvider,
  type ConnectorStatus,
  type ConnectorTransport,
} from "../../../shared/connector-catalog";
import type { Connector } from "../models/workspace";

/**
 * The connector API.
 *
 * Two rules shape this module: credentials only ever travel to the server and
 * a connector is only shown as connected when the server says it verified the
 * connection. Responses are validated field by field and reduced to public
 * status metadata, so an unexpected payload cannot fake a connection and
 * cannot smuggle a token into browser storage.
 */

export type ConnectorTestResult = {
  ok: boolean;
  status?: number;
  latencyMs: number;
  detail: string;
  /** Where the server really sent the request, without its query string. */
  target?: string;
  tools?: string[];
  checkedAt: number;
};

export type ConnectorEvent = {
  action: string;
  detail: string;
  ok: boolean;
  createdAt: number;
};

export type ConnectorCatalogEntry = {
  id: string;
  name: string;
  description: string;
  provider: ConnectorProvider;
  authTypes: ConnectorAuthType[];
  note: string;
  docsUrl: string;
  fields: Partial<Record<ConnectorAuthType, ConnectorField[]>>;
  /** True when this server really holds an OAuth app for the provider. */
  oauthConfigured: boolean;
};

async function request<T>(path: string, init?: RequestInit & { raw?: boolean }): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  return readJSON<T>(response);
}

function status(value: unknown): ConnectorStatus | null {
  return connectorStatuses.includes(value as ConnectorStatus) ? (value as ConnectorStatus) : null;
}

function string(value: unknown, max = 400): string | undefined {
  return typeof value === "string" && value.length <= max ? value : undefined;
}

/** Keep only the public fields; never persist unknown response data. */
function connector(value: unknown): Connector | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const parsedStatus = status(item.status);
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.description !== "string" ||
    !connectorProviders.includes(item.provider as ConnectorProvider) ||
    !parsedStatus ||
    !Array.isArray(item.scopes) ||
    !item.scopes.every((scope) => typeof scope === "string")
  )
    return null;
  const authTypes = Array.isArray(item.authTypes)
    ? (item.authTypes.filter((type): type is ConnectorAuthType =>
        ["oauth", "api_key", "webhook", "mcp"].includes(type as string),
      ) as ConnectorAuthType[])
    : [];
  return {
    id: item.id,
    name: item.name.slice(0, 120),
    description: item.description.slice(0, 600),
    provider: item.provider as ConnectorProvider,
    status: parsedStatus,
    scopes: (item.scopes as string[]).map((scope) => String(scope).slice(0, 120)),
    ...(string(item.connectedAt, 40) ? { connectedAt: item.connectedAt as string } : {}),
    ...(string(item.endpoint, 2048) ? { endpoint: item.endpoint as string } : {}),
    ...(item.transport === "sse" || item.transport === "streamable-http"
      ? { transport: item.transport as ConnectorTransport }
      : {}),
    ...(typeof item.configured === "boolean" ? { configured: item.configured } : {}),
    ...(typeof item.custom === "boolean" ? { custom: item.custom } : {}),
    ...(authTypes.length ? { authTypes } : {}),
    ...(["oauth", "api_key", "webhook", "mcp"].includes(item.authType as string)
      ? { authType: item.authType as ConnectorAuthType }
      : {}),
    ...(string(item.credentialHint, 40) ? { credentialHint: item.credentialHint as string } : {}),
    ...(string(item.lastError, 400) ? { lastError: item.lastError as string } : {}),
    ...(typeof item.lastCheckedAt === "number" ? { lastCheckedAt: Number(item.lastCheckedAt) } : {}),
    ...(string(item.note, 600) ? { note: item.note as string } : {}),
    ...(string(item.docsUrl, 600) ? { docsUrl: item.docsUrl as string } : {}),
  };
}

function connectors(value: unknown): Connector[] {
  if (!Array.isArray(value)) throw new Error("连接器接口返回了无效的状态数据，无法确认连接。");
  const result: Connector[] = [];
  for (const item of value) {
    const parsed = connector(item);
    if (!parsed) throw new Error("连接器接口返回了无效的状态数据，无法确认连接。");
    result.push(parsed);
  }
  return result;
}

export async function listConnectors(signal?: AbortSignal): Promise<Connector[]> {
  const result = await request<unknown>("/connectors", { signal });
  return connectors(result);
}

export async function fetchConnectorCatalog(signal?: AbortSignal): Promise<ConnectorCatalogEntry[]> {
  const body = await request<{ connectors?: unknown }>("/connectors/catalog", { signal });
  if (!Array.isArray(body?.connectors)) throw new Error("连接器目录接口返回了无效数据。");
  return body.connectors as ConnectorCatalogEntry[];
}

export type ConnectorInput = {
  authType?: ConnectorAuthType;
  endpoint?: string;
  transport?: ConnectorTransport;
  name?: string;
  description?: string;
  [field: string]: string | undefined;
};

export async function createConnector(input: ConnectorInput): Promise<Connector> {
  const body = await request<unknown>("/connectors", { method: "POST", body: JSON.stringify(input) });
  const parsed = connector(body);
  if (!parsed) throw new Error("连接器接口返回了无效的状态数据。");
  return parsed;
}

export async function configureConnector(id: string, input: ConnectorInput): Promise<Connector> {
  const body = await request<unknown>(`/connectors/${encodeURIComponent(id)}/configure`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const parsed = connector(body);
  if (!parsed) throw new Error("连接器接口返回了无效的状态数据。");
  return parsed;
}

/** A real connectivity check: the server dials the service and reports back. */
export async function testConnector(id: string, input: ConnectorInput = {}): Promise<ConnectorTestResult> {
  const body = await request<Record<string, unknown>>(`/connectors/${encodeURIComponent(id)}/test`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return {
    ok: body.ok === true,
    ...(typeof body.status === "number" ? { status: Number(body.status) } : {}),
    latencyMs: Number(body.latencyMs) || 0,
    detail: typeof body.detail === "string" ? body.detail : "",
    ...(typeof body.target === "string" ? { target: body.target.slice(0, 2048) } : {}),
    ...(Array.isArray(body.tools) ? { tools: body.tools.map((tool) => String(tool)) } : {}),
    checkedAt: Number(body.checkedAt) || Date.now(),
  };
}

/** Verify and connect. The server only reports success after a real probe. */
export async function connectConnector(
  id: string,
  input: ConnectorInput = {},
): Promise<{ connector: Connector; result: ConnectorTestResult }> {
  const body = await request<Record<string, unknown>>(`/connectors/${encodeURIComponent(id)}/connect`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const record = connector(body.connector);
  if (!record) throw new Error("连接器接口返回了无效的状态数据。");
  return {
    connector: record,
    result: {
      ok: (body.result as { ok?: boolean } | undefined)?.ok === true,
      latencyMs: Number((body.result as { latencyMs?: number } | undefined)?.latencyMs) || 0,
      detail: String((body.result as { detail?: string } | undefined)?.detail ?? ""),
      ...(typeof (body.result as { target?: string } | undefined)?.target === "string"
        ? { target: String((body.result as { target: string }).target).slice(0, 2048) }
        : {}),
      ...(Array.isArray((body.result as { tools?: unknown[] } | undefined)?.tools)
        ? { tools: ((body.result as { tools: unknown[] }).tools).map((tool) => String(tool)) }
        : {}),
      checkedAt: Number((body.result as { checkedAt?: number } | undefined)?.checkedAt) || Date.now(),
    },
  };
}

export async function disconnectConnector(id: string): Promise<Connector | null> {
  const body = await request<{ connector?: unknown }>(`/connectors/${encodeURIComponent(id)}/disconnect`, {
    method: "POST",
    body: "{}",
  });
  return connector(body?.connector);
}

export async function deleteConnector(id: string): Promise<void> {
  await request<void>(`/connectors/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchConnectorEvents(id: string, signal?: AbortSignal): Promise<ConnectorEvent[]> {
  const body = await request<{ events?: unknown }>(`/connectors/${encodeURIComponent(id)}/events`, { signal });
  if (!Array.isArray(body?.events)) return [];
  return (body.events as Array<Record<string, unknown>>).map((event) => ({
    action: String(event.action ?? ""),
    detail: String(event.detail ?? ""),
    ok: event.ok !== false,
    createdAt: Number(event.createdAt) || 0,
  }));
}

/** The server returns a provider-hosted authorization URL; no secret is handled here. */
export function beginConnectorOAuth(
  connectorId: string,
  returnTo = window.location.href,
): Promise<{ authorizationUrl: string }> {
  return request<{ authorizationUrl: string }>("/connectors/oauth/start", {
    method: "POST",
    body: JSON.stringify({ connectorId, returnTo }),
  });
}

const OAUTH_HOSTS: Record<string, { host: string; path: string }> = {
  gmail: { host: "accounts.google.com", path: "/o/oauth2/v2/auth" },
  github: { host: "github.com", path: "/login/oauth/authorize" },
  notion: { host: "api.notion.com", path: "/v1/oauth/authorize" },
  outlook: { host: "login.microsoftonline.com", path: "/common/oauth2/v2.0/authorize" },
  linear: { host: "linear.app", path: "/oauth/authorize" },
  figma: { host: "www.figma.com", path: "/oauth" },
  canva: { host: "www.canva.com", path: "/api/oauth/authorize" },
};

/**
 * Only redirect to the provider the server named for this connector. A broken
 * or hostile backend must not be able to send the browser anywhere else.
 */
export function assertExpectedOAuthUrl(connectorId: string, authorizationUrl: string): string {
  let url: URL;
  try {
    url = new URL(authorizationUrl);
  } catch {
    throw new Error("授权服务返回了非预期的授权地址，已阻止跳转。");
  }
  const expected = OAUTH_HOSTS[connectorId];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !expected ||
    url.hostname !== expected.host ||
    url.pathname !== expected.path
  )
    throw new Error("授权服务返回了非预期的授权地址，已阻止跳转。");
  return url.href;
}
