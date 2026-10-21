import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { responseJSON, sameOrigin } from "./workspace-backend";
import {
  connectorDefinitions,
  findConnectorDefinition,
  type ConnectorAuthType,
  type ConnectorDefinition,
  type ConnectorField,
  type ConnectorProbe,
  type ConnectorProvider,
  type ConnectorStatus,
  type ConnectorTransport,
  type ConnectorWebhookSpec,
} from "../../shared/connector-catalog";

/**
 * Connectors: real configuration, real authorization, real verification.
 *
 * Everything a person types here is a credential: an OAuth token, an API key,
 * a webhook signing secret. The rules this file follows:
 *
 * - Credentials are stored in SQLite encrypted with AES-256-GCM. The key comes
 *   from `DESIGNBUDDY_CONNECTOR_KEY` or from a 0600 key file next to the
 *   database, and never leaves the server.
 * - The browser never receives a credential. It gets a masked hint only.
 * - A connector only becomes `connected` after the server really talked to the
 *   remote service: an OAuth token exchange plus a live API call, a signed
 *   webhook delivery, a JSON-RPC handshake with an MCP server, or an
 *   authenticated HTTP probe. Failure is recorded, never hidden.
 * - Outbound requests are guarded against private-network and metadata targets
 *   unless an operator deliberately allows them for local development.
 */

export type { ConnectorAuthType, ConnectorStatus, ConnectorTransport };

/** What the browser is allowed to see. There is no credential in here. */
export type ConnectorRecord = {
  id: string;
  name: string;
  description: string;
  provider: ConnectorProvider;
  status: ConnectorStatus;
  scopes: string[];
  connectedAt?: string;
  /** The auth types the connector really supports. */
  authTypes: ConnectorAuthType[];
  authType: ConnectorAuthType;
  endpoint?: string;
  transport?: ConnectorTransport;
  /** True once the server holds credentials or a complete configuration. */
  configured: boolean;
  custom: boolean;
  /** Masked tail of the saved credential, for example `…7f3a`. */
  credentialHint?: string;
  lastError?: string;
  lastCheckedAt?: number;
  note: string;
  docsUrl: string;
};

export type ProbeOutcome = {
  ok: boolean;
  status?: number;
  latencyMs: number;
  detail: string;
  tools?: string[];
  /** Where the request really went, without the query string. */
  target?: string;
};

export type ConnectorTestResult = ProbeOutcome & {
  connectorId: string;
  authType: ConnectorAuthType;
  checkedAt: number;
};

export class ConnectorInputError extends Error {}
/** The operator has not configured the OAuth app (or the provider credential) yet. */
export class ConnectorNotConfiguredError extends Error {}

type StoredRow = {
  owner_id: string;
  connector_id: string;
  name: string;
  description: string;
  provider: string;
  auth_type: string;
  status: string;
  scopes: string;
  endpoint: string | null;
  transport: string | null;
  credential: string | null;
  hint: string | null;
  last_error: string | null;
  last_checked_at: number;
  connected_at: string | null;
  updated_at: number;
};

type Credential = Record<string, string>;

const CONNECTOR_TIMEOUT_MS = 15_000;
const MAX_FIELD_LENGTH = 4096;
const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 400;
const MAX_ENDPOINT_LENGTH = 2048;
const MAX_CUSTOM_CONNECTORS = 50;
const OAUTH_STATE_TTL_MS = 10 * 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

/** Query parameters that must never carry a secret in a saved URL. */
const FORBIDDEN_QUERY_KEYS = [
  "token",
  "access_token",
  "api_key",
  "apikey",
  "key",
  "secret",
  "password",
  "signature",
  "sign",
  "sig",
];
/**
 * A webhook URL identifies its bot in the query string (WeCom uses `key`), so
 * only signing material is refused there - and never the parameters this
 * server adds itself while signing a delivery.
 */
const FORBIDDEN_WEBHOOK_QUERY_KEYS = FORBIDDEN_QUERY_KEYS.filter((item) => item !== "key");

export interface ConnectorServiceOptions {
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Allow http:// and private-network targets. Off unless the operator sets
   * `DESIGNBUDDY_CONNECTORS_ALLOW_PRIVATE_NETWORK=true` (local development,
   * self-hosted gateways and the automated tests).
   */
  allowPrivateNetwork?: boolean;
  /** Override the credential encryption key (tests). */
  encryptionKey?: Buffer;
  /** Override the clock (tests). */
  now?: () => number;
  /** Skip writing DNS/URL guard logs. */
  silent?: boolean;
}

// ---------------------------------------------------------------------------
// Credential encryption
// ---------------------------------------------------------------------------

const KEY_ENV = "DESIGNBUDDY_CONNECTOR_KEY";
const KEY_FILE_ENV = "DESIGNBUDDY_CONNECTOR_KEY_FILE";
const KEY_SALT = "designbuddy-connectors-v1";

function loadMasterKey(explicit?: Buffer): Buffer {
  if (explicit) return explicit;
  const fromEnv = process.env[KEY_ENV]?.trim();
  if (fromEnv) return scryptSync(fromEnv, KEY_SALT, 32);
  const file = resolve(process.env[KEY_FILE_ENV] || "./data/connectors/master.key");
  if (existsSync(file)) {
    const hex = readFileSync(file, "utf8").trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, "hex");
  }
  const key = randomBytes(32);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, key.toString("hex"), { mode: 0o600 });
  return key;
}

function encryptCredential(key: Buffer, credential: Credential): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.from(JSON.stringify(credential), "utf8");
  const body = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

function decryptCredential(key: Buffer, stored: string | null): Credential | null {
  if (!stored) return null;
  const [version, ivPart, tagPart, bodyPart] = stored.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !bodyPart) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const payload = Buffer.concat([
      decipher.update(Buffer.from(bodyPart, "base64url")),
      decipher.final(),
    ]);
    const parsed: unknown = JSON.parse(payload.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const result: Credential = {};
    for (const [field, value] of Object.entries(parsed as Record<string, unknown>))
      if (typeof value === "string") result[field] = value;
    return result;
  } catch {
    // A key rotation or a corrupt row must not look like a connected account.
    return null;
  }
}

/** A masked tail so a person can tell which key is in use without seeing it. */
function credentialHint(definition: ConnectorDefinition | undefined, authType: ConnectorAuthType, credential: Credential): string | undefined {
  const fields = fieldsForAuthType(definition, authType).filter((field) => field.hintable);
  for (const field of fields) {
    const value = credential[field.key];
    if (typeof value === "string" && value.length > 0) {
      if (value.length <= 8) return "已保存";
      return `…${value.slice(-4)}`;
    }
  }
  return Object.keys(credential).length ? "已保存" : undefined;
}

// ---------------------------------------------------------------------------
// Field / configuration helpers
// ---------------------------------------------------------------------------

const ENDPOINT_FIELD: ConnectorField = {
  key: "endpoint",
  label: "服务地址",
  kind: "url",
  required: true,
  placeholder: "https://your-server.example/mcp",
  help: "仅保存不含账号密码的 HTTPS 地址；密钥请填写在下方凭据字段。",
};

const TRANSPORT_FIELD: ConnectorField = {
  key: "transport",
  label: "传输协议",
  kind: "select",
  options: ["streamable-http", "sse"],
};

const GENERIC_TOKEN_FIELD: ConnectorField = {
  key: "token",
  label: "访问令牌（可选）",
  kind: "password",
  placeholder: "Bearer …",
  help: "服务端会以 Authorization: Bearer 头发送，不会回传给浏览器。",
  hintable: true,
};

const GENERIC_WEBHOOK: ConnectorWebhookSpec = {
  bodyTemplate: JSON.stringify({ msg_type: "text", content: { text: "DesignBuddy 连接器连通性测试 {{timestamp}}" } }),
  acceptStatus: [200],
  acceptBodyAny: ['"errcode":0', '"code":0', '"StatusCode":0', "success", "ok"],
};

/** The inputs one auth type needs, including a URL when the target is not fixed. */
export function fieldsForAuthType(definition: ConnectorDefinition | undefined, authType: ConnectorAuthType): ConnectorField[] {
  if (authType === "api_key") {
    const fields = definition?.apiKey?.fields ?? [GENERIC_TOKEN_FIELD];
    return definition?.apiKey?.requiresEndpoint ? [ENDPOINT_FIELD, ...fields] : fields;
  }
  if (authType === "webhook")
    return [
      { ...ENDPOINT_FIELD, label: "Webhook 地址", help: definition?.webhook?.urlHint || ENDPOINT_FIELD.help },
      ...(definition?.webhook?.signature
        ? [
            {
              key: "secret",
              label: "签名密钥",
              kind: "password" as const,
              required: true,
              hintable: true,
              help: "仅用于计算请求签名，服务端加密保存。",
            },
          ]
        : []),
    ];
  if (authType === "mcp")
    return [
      { ...ENDPOINT_FIELD },
      { ...TRANSPORT_FIELD, options: definition?.mcp?.transports ?? ["streamable-http", "sse"] },
      ...(definition?.mcp?.tokenField ? [definition.mcp.tokenField] : [GENERIC_TOKEN_FIELD]),
    ];
  return [];
}

/** A definition for a connector the person defined themselves. */
function synthesizeDefinition(row: Pick<StoredRow, "connector_id" | "name" | "description" | "auth_type">): ConnectorDefinition {
  const authType = (row.auth_type === "webhook" ? "webhook" : "mcp") as ConnectorAuthType;
  return {
    id: row.connector_id,
    name: row.name,
    description: row.description,
    provider: "custom",
    authTypes: ["mcp", "webhook"],
    mcp: {
      transports: ["streamable-http", "sse"],
      defaultTransport: "streamable-http",
      tokenField: GENERIC_TOKEN_FIELD,
    },
    webhook: GENERIC_WEBHOOK,
    note: "自定义连接器：服务端会向你填写的地址发起真实握手或投递，只有对方确认成功才会标记为已连接。",
    docsUrl: "https://modelcontextprotocol.io/",
  };
}

// ---------------------------------------------------------------------------
// URL safety
// ---------------------------------------------------------------------------

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
    return false;
  }
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    if (value === "::1" || value === "::") return true;
    if (/^(fc|fd)/.test(value)) return true;
    if (/^fe[89ab]/.test(value)) return true;
    if (value.startsWith("::ffff:")) return isPrivateAddress(value.slice(7));
    return false;
  }
  return false;
}

function looksInternalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa") ||
    host === "metadata.google.internal" ||
    host === "metadata" ||
    host.endsWith(".cluster.local")
  );
}

/**
 * Reject targets that would turn a user supplied URL into access to the
 * server's own network. DNS is resolved before the request, which stops the
 * obvious literal cases; the deliberate escape hatch is required for local
 * development and self-hosted gateways.
 */
async function assertReachable(rawUrl: string, allowPrivate: boolean): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ConnectorInputError("请填写完整的服务地址（包含 https:// 前缀）。");
  }
  if (url.protocol !== "https:" && !(allowPrivate && url.protocol === "http:"))
    throw new ConnectorInputError("服务地址必须使用 HTTPS。");
  if (url.username || url.password)
    throw new ConnectorInputError("服务地址不能包含账号或密码，请使用凭据字段。");
  for (const key of url.searchParams.keys())
    if (FORBIDDEN_WEBHOOK_QUERY_KEYS.includes(key.toLowerCase()))
      throw new ConnectorInputError(`服务地址的查询参数 ${key} 可能泄露密钥，请使用凭据字段。`);
  if (allowPrivate) return url;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (looksInternalHostname(hostname))
    throw new ConnectorInputError("不允许连接内网地址；如需连接本机服务请由管理员开启 DESIGNBUDDY_CONNECTORS_ALLOW_PRIVATE_NETWORK。");
  if (isIP(hostname) && isPrivateAddress(hostname))
    throw new ConnectorInputError("不允许连接保留网段地址。");
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new ConnectorInputError(`无法解析主机 ${hostname}，请检查服务地址。`);
  }
  if (addresses.length === 0) throw new ConnectorInputError(`无法解析主机 ${hostname}。`);
  for (const entry of addresses)
    if (isPrivateAddress(entry.address))
      throw new ConnectorInputError("该域名解析到内网地址，已阻止连接。");
  return url;
}

// ---------------------------------------------------------------------------
// Templating
// ---------------------------------------------------------------------------

function templateValues(credential: Credential, now: number) {
  return {
    ...credential,
    timestamp: String(now),
    timestampMs: String(now),
    timestampSeconds: String(Math.floor(now / 1000)),
    nonce: randomBytes(8).toString("hex"),
  } as Record<string, string>;
}

function substitute(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

// ---------------------------------------------------------------------------
// Real connectivity probes
// ---------------------------------------------------------------------------

async function readBody(response: Response, limit = 4096): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, limit);
  } catch {
    return "";
  }
}

/**
 * Where a probe went, without the query string: it is shown back to the person
 * who configured it, and a query parameter may legitimately carry a token.
 */
function safeTarget(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

function statusAccepted(status: number, acceptStatus?: number[]): boolean {
  if (acceptStatus?.length) return acceptStatus.includes(status);
  return status >= 200 && status < 300;
}

function summariseHttpFailure(status: number, body: string): string {
  const excerpt = body.replace(/\s+/g, " ").trim().slice(0, 160);
  return excerpt
    ? `远程服务返回 HTTP ${status}：${excerpt}`
    : `远程服务返回 HTTP ${status}。`;
}

/** An authenticated HTTP request against the provider's documented endpoint. */
async function httpProbe(
  probe: ConnectorProbe,
  values: Record<string, string>,
  fetchImpl: typeof fetch,
  allowPrivate: boolean,
): Promise<ProbeOutcome> {
  const target = await assertReachable(substitute(probe.url, values), allowPrivate);
  const method = probe.method || "GET";
  const headers: Record<string, string> = { Accept: "application/json, text/plain, */*" };
  for (const [name, value] of Object.entries(probe.headers || {}))
    headers[name] = substitute(value, values);
  const started = Date.now();
  let response: Response;
  try {
    response = await fetchImpl(target.href, {
      method,
      headers,
      ...(probe.body && method !== "GET" ? { body: substitute(probe.body, values) } : {}),
      redirect: "follow",
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, latencyMs: Date.now() - started, target: safeTarget(target), detail: `无法连接远程服务：${reason}` };
  }
  const latencyMs = Date.now() - started;
  const body = await readBody(response);
  if (!statusAccepted(response.status, probe.acceptStatus))
    return { ok: false, status: response.status, latencyMs, detail: summariseHttpFailure(response.status, body) };
  const markers = probe.acceptBodyAny?.filter(Boolean) ?? [];
  if (markers.length && !markers.some((marker) => body.includes(marker)))
    return {
      ok: false,
      status: response.status,
      latencyMs,
      detail: `远程服务返回了 HTTP ${response.status}，但响应内容中没有成功标记。`,
    };
  return {
    ok: true,
    status: response.status,
    latencyMs,
    target: safeTarget(target),
    detail: `远程服务返回 HTTP ${response.status}，用时 ${latencyMs} ms。`,
  };
}

/** Parse an SSE stream into events without waiting for the whole body. */
async function* readSse(
  body: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
): AsyncGenerator<{ event: string; data: string }> {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf("\n\n");
      while (index !== -1) {
        const chunk = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        let event = "message";
        const data: string[] = [];
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).trim());
          else if (line.startsWith(":")) continue;
        }
        if (data.length) yield { event, data: data.join("\n") };
        index = buffer.indexOf("\n\n");
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* the stream may already be closed */
    }
  }
}

const MCP_PROTOCOL_VERSION = "2025-06-18";

/**
 * A real Model Context Protocol handshake: `initialize` followed by
 * `tools/list`. Streamable HTTP (single JSON answer or an SSE stream) and the
 * older HTTP+SSE transport are both supported.
 */
async function mcpProbe(
  endpoint: string,
  transport: ConnectorTransport,
  token: string,
  fetchImpl: typeof fetch,
  allowPrivate: boolean,
): Promise<ProbeOutcome> {
  const base = await assertReachable(endpoint, allowPrivate);
  const started = Date.now();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (token.trim()) headers.authorization = `Bearer ${token.trim()}`;

  const call = (id: number, method: string, params: Record<string, unknown>) =>
    JSON.stringify({ jsonrpc: "2.0", id, method, params });

  if (transport === "sse") return legacySseProbe(base, headers, fetchImpl, started);

  let response: Response;
  try {
    response = await fetchImpl(base.href, {
      method: "POST",
      headers,
      body: call(1, "initialize", {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "designbuddy", version: "0.1.0" },
      }),
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, latencyMs: Date.now() - started, detail: `无法连接 MCP 服务：${reason}` };
  }

  const contentType = response.headers.get("content-type") || "";
  const sessionId = response.headers.get("mcp-session-id");
  if (sessionId) headers["mcp-session-id"] = sessionId;

  let initialize: { result?: Record<string, unknown>; error?: { message?: string } } | null = null;
  if (contentType.includes("text/event-stream") && response.body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECTOR_TIMEOUT_MS);
    for await (const event of readSse(response.body, controller.signal)) {
      try {
        const parsed = JSON.parse(event.data) as { id?: number; result?: Record<string, unknown>; error?: { message?: string } };
        if (parsed.id === 1) {
          initialize = parsed;
          break;
        }
      } catch {
        /* keep reading: the stream may carry unrelated events first */
      }
    }
    clearTimeout(timer);
  } else {
    const text = await readBody(response, 65536);
    try {
      initialize = JSON.parse(text) as typeof initialize;
    } catch {
      initialize = null;
    }
    if (!initialize && response.ok)
      return { ok: false, status: response.status, latencyMs: Date.now() - started, detail: "MCP 服务返回了无法解析的内容。" };
  }

  if (!response.ok && !initialize)
    return {
      ok: false,
      status: response.status,
      latencyMs: Date.now() - started,
      detail: summariseHttpFailure(response.status, ""),
    };
  if (!initialize || initialize.error)
    return {
      ok: false,
      status: response.status,
      latencyMs: Date.now() - started,
      detail: `MCP 握手被拒绝：${initialize?.error?.message || "服务未返回 initialize 结果。"}`,
    };

  const serverName = serverLabel(initialize.result);
  let tools: string[] = [];
  try {
    const listed = await fetchImpl(base.href, {
      method: "POST",
      headers,
      body: call(2, "tools/list", {}),
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
    });
    const text = await readBody(listed, 65536);
    const parsed = JSON.parse(text) as { result?: { tools?: Array<{ name?: string }> } };
    tools = (parsed.result?.tools ?? []).map((tool) => String(tool.name || "")).filter(Boolean);
  } catch {
    // tools/list is an extra: the handshake already proved the service answers.
  }
  return {
    ok: true,
    status: response.status,
    latencyMs: Date.now() - started,
    target: safeTarget(base),
    detail: serverName
      ? `MCP 握手成功：${serverName}，发现 ${tools.length} 个工具。`
      : `MCP 握手成功，发现 ${tools.length} 个工具。`,
    tools,
  };
}

function serverLabel(result: Record<string, unknown> | undefined): string {
  const info = result?.serverInfo as { name?: string; version?: string } | undefined;
  if (!info?.name) return "";
  return info.version ? `${info.name} ${info.version}` : String(info.name);
}

/**
 * HTTP+SSE transport (protocol version 2024-11-05): open the event stream,
 * read the session endpoint the server publishes, then exchange JSON-RPC over
 * that endpoint and read the answers back from the same stream.
 */
async function legacySseProbe(
  base: URL,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
  started: number,
): Promise<ProbeOutcome> {
  const controller = new AbortController();
  const deadline = Date.now() + CONNECTOR_TIMEOUT_MS;
  try {
    const stream = await fetchImpl(base.href, {
      method: "GET",
      headers: { ...headers, accept: "text/event-stream" },
      signal: controller.signal,
    });
    if (!stream.ok || !stream.body)
      return {
        ok: false,
        status: stream.status,
        latencyMs: Date.now() - started,
        detail: `MCP 服务未建立 SSE 流：HTTP ${stream.status}。`,
      };
    // A manual iterator: `for await … break` would close (and cancel) the
    // stream, but the answers to the POSTs arrive on this very stream.
    const iterator = readSse(stream.body, controller.signal)[Symbol.asyncIterator]();
    const nextEvent = async (): Promise<{ event: string; data: string } | null> => {
      while (Date.now() < deadline && !controller.signal.aborted) {
        const step = await iterator.next();
        if (step.done) return null;
        return step.value;
      }
      return null;
    };

    let sessionUrl: URL | null = null;
    for (let event = await nextEvent(); event; event = await nextEvent()) {
      if (event.event === "endpoint" || /^\/|^https?:\/\//.test(event.data)) {
        try {
          sessionUrl = new URL(event.data, base);
          break;
        } catch {
          /* keep waiting for a usable endpoint event */
        }
      }
    }
    if (!sessionUrl)
      return {
        ok: false,
        latencyMs: Date.now() - started,
        detail: "MCP 服务没有在 SSE 流中给出会话地址（endpoint 事件）。",
      };

    const post = async (id: number, method: string, params: Record<string, unknown>) => {
      await fetchImpl(sessionUrl!.href, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        signal: controller.signal,
      });
    };
    const waitFor = async (id: number): Promise<Record<string, any> | null> => {
      for (let event = await nextEvent(); event; event = await nextEvent()) {
        try {
          const parsed = JSON.parse(event.data) as { id?: number };
          if (parsed.id === id) return parsed as Record<string, any>;
        } catch {
          /* ignore events that are not JSON-RPC answers */
        }
      }
      return null;
    };

    await post(1, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "designbuddy", version: "0.1.0" },
    });
    const initialize = (await waitFor(1)) as
      | { result?: Record<string, unknown>; error?: { message?: string } }
      | null;
    if (!initialize || initialize.error)
      return {
        ok: false,
        latencyMs: Date.now() - started,
        detail: `MCP 握手被拒绝：${initialize?.error?.message || "SSE 流中没有 initialize 结果。"}`,
      };
    await post(2, "tools/list", {});
    const listed = (await waitFor(2)) as { result?: { tools?: Array<{ name?: string }> } } | null;
    const tools = (listed?.result?.tools ?? []).map((tool) => String(tool.name || "")).filter(Boolean);
    const label = serverLabel(initialize.result);
    return {
      ok: true,
      latencyMs: Date.now() - started,
      target: safeTarget(base),
      detail: label
        ? `MCP 握手成功（SSE 传输）：${label}，发现 ${tools.length} 个工具。`
        : `MCP 握手成功（SSE 传输），发现 ${tools.length} 个工具。`,
      tools,
    };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, latencyMs: Date.now() - started, detail: `无法连接 MCP 服务：${reason}` };
  } finally {
    controller.abort();
  }
}

/** A real webhook delivery, signed exactly the way the platform documents it. */
async function webhookProbe(
  endpoint: string,
  spec: ConnectorWebhookSpec,
  credential: Credential,
  values: Record<string, string>,
  fetchImpl: typeof fetch,
  allowPrivate: boolean,
): Promise<ProbeOutcome> {
  const target = await assertReachable(substitute(endpoint, values), allowPrivate);
  const signature = spec.signature;
  let body = substitute(spec.bodyTemplate || "{}", values);
  if (signature) {
    const key = substitute(signature.keyTemplate, values);
    const message = substitute(signature.messageTemplate, values);
    const digest = createHmac("sha256", key).update(message).digest(signature.encoding === "hex" ? "hex" : "base64");
    if (signature.bodyField) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        parsed[signature.bodyField] = digest;
        body = JSON.stringify(parsed);
      } catch {
        return { ok: false, latencyMs: 0, detail: "Webhook 请求体模板不是合法 JSON，无法写入签名。" };
      }
    }
    if (signature.queryField) target.searchParams.set(signature.queryField, digest);
    if (signature.timestampQueryField)
      target.searchParams.set(
        signature.timestampQueryField,
        signature.timestampUnit === "s" ? values.timestampSeconds : values.timestampMs,
      );
  }
  const started = Date.now();
  let response: Response;
  try {
    response = await fetchImpl(target.href, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8", accept: "application/json" },
      body,
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, latencyMs: Date.now() - started, detail: `无法送达 Webhook：${reason}` };
  }
  const latencyMs = Date.now() - started;
  const text = await readBody(response);
  if (!statusAccepted(response.status, spec.acceptStatus))
    return { ok: false, status: response.status, latencyMs, detail: summariseHttpFailure(response.status, text) };
  const markers = spec.acceptBodyAny?.filter(Boolean) ?? [];
  if (markers.length && !markers.some((marker) => text.includes(marker)))
    return {
      ok: false,
      status: response.status,
      latencyMs,
      detail: `Webhook 返回了 HTTP ${response.status}，但响应体中没有成功标记（${text.replace(/\s+/g, " ").slice(0, 120)}）。`,
    };
  return {
    ok: true,
    status: response.status,
    latencyMs,
    target: `${target.origin}${target.pathname}`,
    detail: `测试消息已送达，用时 ${latencyMs} ms。`,
  };
}

/** The probe a connector really runs, per auth type. */
async function runProbe(
  definition: ConnectorDefinition,
  authType: ConnectorAuthType,
  config: { endpoint?: string; transport?: ConnectorTransport },
  credential: Credential,
  options: { fetchImpl: typeof fetch; allowPrivate: boolean; now: number },
): Promise<ProbeOutcome & { target?: string }> {
  const values = templateValues(credential, options.now);
  if (authType === "oauth") {
    const probe = definition.oauth?.probe;
    if (!probe) return { ok: false, latencyMs: 0, detail: "该连接器没有可用的 OAuth 校验接口。" };
    return httpProbe(probe, values, options.fetchImpl, options.allowPrivate);
  }
  if (authType === "api_key") {
    const spec = definition.apiKey;
    const probe: ConnectorProbe =
      spec?.probe ?? {
        url: config.endpoint || "",
        method: "GET",
        headers: spec?.headers ?? { Authorization: "Bearer {{token}}" },
      };
    if (!probe.url) return { ok: false, latencyMs: 0, detail: "请先填写用于校验的服务地址。" };
    return httpProbe(probe, values, options.fetchImpl, options.allowPrivate);
  }
  if (authType === "webhook") {
    if (!config.endpoint) return { ok: false, latencyMs: 0, detail: "请先填写 Webhook 地址。" };
    return webhookProbe(
      config.endpoint,
      definition.webhook ?? GENERIC_WEBHOOK,
      credential,
      values,
      options.fetchImpl,
      options.allowPrivate,
    );
  }
  if (!config.endpoint) return { ok: false, latencyMs: 0, detail: "请先填写 MCP 服务地址。" };
  return mcpProbe(
    config.endpoint,
    config.transport === "sse" ? "sse" : "streamable-http",
    credential.token || "",
    options.fetchImpl,
    options.allowPrivate,
  );
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ConnectorService {
  private db: DatabaseSync;
  private key: Buffer;
  private fetchImpl: typeof fetch;
  private allowPrivate: boolean;
  private clock: () => number;
  private attempts = new Map<string, { count: number; until: number }>();

  constructor(
    file = process.env.DESIGNBUDDY_CONNECTORS_SQLITE_PATH || "./data/connectors.sqlite",
    options: ConnectorServiceOptions = {},
  ) {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS connector_connections(
        owner_id TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        provider TEXT NOT NULL,
        auth_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'disconnected',
        scopes TEXT NOT NULL DEFAULT '[]',
        endpoint TEXT,
        transport TEXT,
        credential TEXT,
        hint TEXT,
        last_error TEXT,
        last_checked_at INTEGER NOT NULL DEFAULT 0,
        connected_at TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (owner_id, connector_id)
      );
      CREATE TABLE IF NOT EXISTS connector_oauth_states(
        state TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        return_to TEXT NOT NULL DEFAULT '/connectors/oauth',
        code_verifier TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS connector_events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        ok INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS connector_events_owner ON connector_events(owner_id, connector_id, created_at DESC);`);
    this.key = loadMasterKey(options.encryptionKey);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.allowPrivate =
      options.allowPrivateNetwork ??
      ["1", "true", "yes"].includes((process.env.DESIGNBUDDY_CONNECTORS_ALLOW_PRIVATE_NETWORK || "").toLowerCase());
    this.clock = options.now ?? (() => Date.now());
  }

  close() {
    this.db.close();
  }

  private now() {
    return this.clock();
  }

  /** Coarse per-owner throttle: probes are outbound requests paid for by this server. */
  private rateLimited(ownerId: string, action: string): boolean {
    const key = `${ownerId}:${action}`;
    const now = this.now();
    if (this.attempts.size > 5000) this.attempts.clear();
    const entry = this.attempts.get(key);
    if (!entry || entry.until < now) {
      this.attempts.set(key, { count: 1, until: now + RATE_LIMIT_WINDOW_MS });
      return false;
    }
    entry.count += 1;
    return entry.count > RATE_LIMIT_MAX;
  }

  private record(ownerId: string, connectorId: string, action: string, ok: boolean, detail = "") {
    this.db
      .prepare(
        "INSERT INTO connector_events(owner_id,connector_id,action,detail,ok,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(ownerId, connectorId, action, detail.slice(0, 300), ok ? 1 : 0, this.now());
  }

  events(ownerId: string, connectorId: string, limit = 50) {
    const rows = this.db
      .prepare(
        "SELECT action,detail,ok,created_at FROM connector_events WHERE owner_id=? AND connector_id=? ORDER BY created_at DESC LIMIT ?",
      )
      .all(ownerId, connectorId, Math.max(1, Math.min(200, limit))) as Array<{
      action: string;
      detail: string;
      ok: number;
      created_at: number;
    }>;
    return rows.map((row) => ({
      action: row.action,
      detail: row.detail || "",
      ok: Boolean(row.ok),
      createdAt: Number(row.created_at),
    }));
  }

  private row(ownerId: string, connectorId: string): StoredRow | undefined {
    return this.db
      .prepare("SELECT * FROM connector_connections WHERE owner_id=? AND connector_id=?")
      .get(ownerId, connectorId) as StoredRow | undefined;
  }

  private rows(ownerId: string): StoredRow[] {
    return this.db
      .prepare("SELECT * FROM connector_connections WHERE owner_id=? ORDER BY updated_at DESC")
      .all(ownerId) as StoredRow[];
  }

  private credentialOf(row: StoredRow | undefined): Credential {
    return decryptCredential(this.key, row?.credential ?? null) ?? {};
  }

  private save(
    ownerId: string,
    connectorId: string,
    patch: {
      name?: string;
      description?: string;
      provider?: string;
      authType?: ConnectorAuthType;
      status?: ConnectorStatus;
      scopes?: string[];
      endpoint?: string | null;
      transport?: ConnectorTransport | null;
      credential?: Credential | null;
      hint?: string | null;
      lastError?: string | null;
      lastCheckedAt?: number;
      connectedAt?: string | null;
    },
  ): StoredRow {
    const current = this.row(ownerId, connectorId);
    const definition = findConnectorDefinition(connectorId);
    const base: StoredRow = current ?? {
      owner_id: ownerId,
      connector_id: connectorId,
      name: definition?.name ?? connectorId,
      description: definition?.description ?? "",
      provider: definition?.provider ?? "custom",
      auth_type: (definition?.authTypes[0] ?? "mcp") as string,
      status: "disconnected",
      scopes: "[]",
      endpoint: null,
      transport: null,
      credential: null,
      hint: null,
      last_error: null,
      last_checked_at: 0,
      connected_at: null,
      updated_at: this.now(),
    };
    const credential =
      patch.credential === undefined
        ? base.credential
        : patch.credential === null
          ? null
          : encryptCredential(this.key, patch.credential);
    const next: StoredRow = {
      ...base,
      name: patch.name ?? base.name,
      description: patch.description ?? base.description,
      provider: patch.provider ?? base.provider,
      auth_type: patch.authType ?? base.auth_type,
      status: patch.status ?? base.status,
      scopes: JSON.stringify(patch.scopes ?? (safeJsonArray(base.scopes) as string[])),
      endpoint: patch.endpoint === undefined ? base.endpoint : patch.endpoint,
      transport: patch.transport === undefined ? base.transport : patch.transport,
      credential,
      hint: patch.hint === undefined ? base.hint : patch.hint,
      last_error: patch.lastError === undefined ? base.last_error : patch.lastError,
      last_checked_at: patch.lastCheckedAt ?? base.last_checked_at,
      connected_at: patch.connectedAt === undefined ? base.connected_at : patch.connectedAt,
      updated_at: this.now(),
    };
    this.db
      .prepare(`INSERT INTO connector_connections(owner_id,connector_id,name,description,provider,auth_type,status,scopes,endpoint,transport,credential,hint,last_error,last_checked_at,connected_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(owner_id,connector_id) DO UPDATE SET
          name=excluded.name,description=excluded.description,provider=excluded.provider,auth_type=excluded.auth_type,
          status=excluded.status,scopes=excluded.scopes,endpoint=excluded.endpoint,transport=excluded.transport,
          credential=excluded.credential,hint=excluded.hint,last_error=excluded.last_error,
          last_checked_at=excluded.last_checked_at,connected_at=excluded.connected_at,updated_at=excluded.updated_at`)
      .run(
        next.owner_id,
        next.connector_id,
        next.name,
        next.description,
        next.provider,
        next.auth_type,
        next.status,
        next.scopes,
        next.endpoint,
        next.transport,
        next.credential,
        next.hint,
        next.last_error,
        next.last_checked_at,
        next.connected_at,
        next.updated_at,
      );
    return next;
  }

  private definitionFor(row: StoredRow): ConnectorDefinition {
    return findConnectorDefinition(row.connector_id) ?? synthesizeDefinition(row);
  }

  private publicRecord(ownerId: string, definition: ConnectorDefinition, row?: StoredRow): ConnectorRecord {
    const credential = this.credentialOf(row);
    const authType = (row?.auth_type && isAuthType(row.auth_type) ? row.auth_type : definition.authTypes[0]) as ConnectorAuthType;
    const status = (row?.status && isStatus(row.status) ? row.status : "disconnected") as ConnectorStatus;
    const hasCredential = Object.keys(credential).length > 0;
    const configured = Boolean(row && (hasCredential || Boolean(row.endpoint) || authType === "oauth"));
    const hint = row?.hint || credentialHint(definition, authType, credential);
    return {
      id: definition.id,
      name: row?.name || definition.name,
      description: row?.description || definition.description,
      provider: definition.provider,
      status,
      scopes: safeJsonArray(row?.scopes) as string[],
      ...(row?.connected_at ? { connectedAt: row.connected_at } : {}),
      authTypes: definition.authTypes,
      authType,
      ...(row?.endpoint ? { endpoint: row.endpoint } : {}),
      ...(row?.transport && isTransport(row.transport) ? { transport: row.transport as ConnectorTransport } : {}),
      configured,
      custom: !findConnectorDefinition(definition.id),
      ...(hint ? { credentialHint: hint } : {}),
      ...(row?.last_error ? { lastError: row.last_error } : {}),
      ...(row?.last_checked_at ? { lastCheckedAt: Number(row.last_checked_at) } : {}),
      note: definition.note,
      docsUrl: definition.docsUrl,
    };
  }

  /** Every built-in connector, plus the connectors this person defined. */
  list(ownerId: string): ConnectorRecord[] {
    const rows = new Map(this.rows(ownerId).map((row) => [row.connector_id, row]));
    const records = connectorDefinitions.map((definition) => this.publicRecord(ownerId, definition, rows.get(definition.id)));
    for (const [id, row] of rows)
      if (!findConnectorDefinition(id))
        records.push(this.publicRecord(ownerId, synthesizeDefinition(row), row));
    return records;
  }

  /**
   * The catalogue the browser renders the configuration form from: every
   * built-in connector plus the connectors this person defined themselves.
   */
  catalog(ownerId: string) {
    const entries = connectorDefinitions.map((definition) => ({ definition, custom: false }));
    for (const row of this.rows(ownerId))
      if (!findConnectorDefinition(row.connector_id))
        entries.push({ definition: synthesizeDefinition(row), custom: true });
    return entries.map(({ definition, custom }) => ({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      provider: definition.provider,
      authTypes: definition.authTypes,
      note: definition.note,
      docsUrl: definition.docsUrl,
      custom,
      fields: Object.fromEntries(
        definition.authTypes.map((authType) => [authType, fieldsForAuthType(definition, authType)]),
      ) as Record<string, ConnectorField[]>,
      oauthConfigured: definition.oauth
        ? Boolean(
            process.env[definition.oauth.clientIdEnv]?.trim() &&
              process.env[definition.oauth.clientSecretEnv]?.trim(),
          )
        : false,
    }));
  }

  // -- configuration --------------------------------------------------------

  private readCredentials(
    definition: ConnectorDefinition,
    authType: ConnectorAuthType,
    body: Record<string, unknown>,
    existing: Credential,
  ): Credential {
    const fields = fieldsForAuthType(definition, authType);
    const credential: Credential = {};
    for (const field of fields) {
      // The endpoint and the transport are configuration, not credentials.
      if (field.kind === "select" || field.key === "endpoint" || field.key === "transport") continue;
      const raw = body[field.key];
      // An untouched field keeps the credential already on the server; sending
      // an empty value is how a person removes one.
      if (raw === undefined) {
        if (existing[field.key]) credential[field.key] = existing[field.key];
        else if (field.required) throw new ConnectorInputError(`请填写${field.label}。`);
        continue;
      }
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value.length > MAX_FIELD_LENGTH) throw new ConnectorInputError(`${field.label} 过长。`);
      if (value) {
        credential[field.key] = value;
      } else if (field.required && !existing[field.key]) {
        throw new ConnectorInputError(`请填写${field.label}。`);
      }
    }
    // Unknown keys are dropped: the browser cannot smuggle extra secrets in.
    return credential;
  }

  private readEndpoint(
    body: Record<string, unknown>,
    existing: string | null | undefined,
    authType: ConnectorAuthType,
  ): string | null {
    const raw = body.endpoint;
    if (raw === undefined) return existing ?? null;
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return null;
    if (value.length > MAX_ENDPOINT_LENGTH) throw new ConnectorInputError("服务地址过长。");
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new ConnectorInputError("请填写有效的服务地址。");
    }
    if (url.protocol !== "https:" && !(this.allowPrivate && url.protocol === "http:"))
      throw new ConnectorInputError("服务地址必须使用 HTTPS。");
    if (url.username || url.password)
      throw new ConnectorInputError("服务地址不能包含账号或密码。");
    // A webhook URL legitimately identifies the bot in its query string (for
    // example WeCom's `key`), so only signing material is refused there.
    const forbidden = authType === "webhook" ? FORBIDDEN_WEBHOOK_QUERY_KEYS : FORBIDDEN_QUERY_KEYS;
    for (const key of url.searchParams.keys())
      if (forbidden.includes(key.toLowerCase()))
        throw new ConnectorInputError(`服务地址的查询参数 ${key} 可能泄露密钥，请使用凭据字段。`);
    return url.href;
  }

  /** Save the configuration of a connector without claiming that it works. */
  configure(
    ownerId: string,
    connectorId: string,
    body: Record<string, unknown>,
  ): ConnectorRecord {
    const definition = findConnectorDefinition(connectorId);
    const row = this.row(ownerId, connectorId);
    const resolved = definition ?? synthesizeDefinition({
      connector_id: connectorId,
      name: row?.name ?? String(body.name ?? connectorId),
      description: row?.description ?? "",
      auth_type: row?.auth_type ?? "mcp",
    });
    const requested = typeof body.authType === "string" ? (body.authType as ConnectorAuthType) : undefined;
    const authType = requested && resolved.authTypes.includes(requested) ? requested : (row?.auth_type as ConnectorAuthType) ?? resolved.authTypes[0];
    if (!resolved.authTypes.includes(authType))
      throw new ConnectorInputError("该连接器不支持这种连接方式。");
    if (authType === "oauth")
      throw new ConnectorInputError("该连接方式通过 OAuth 授权完成，请点击授权连接。");
    const endpoint = this.readEndpoint(body, row?.endpoint, authType);
    const transport: ConnectorTransport | null =
      body.transport === "sse" ? "sse" : body.transport === "streamable-http" ? "streamable-http" : (row?.transport as ConnectorTransport | null) ?? null;
    const existing = this.credentialOf(row);
    const credential = this.readCredentials(resolved, authType, body, existing);
    if (authTypeNeedsEndpoint(authType) && !endpoint)
      throw new ConnectorInputError("请先填写服务地址。");
    const saved = this.save(ownerId, connectorId, {
      name: typeof body.name === "string" && body.name.trim() && !definition ? body.name.trim().slice(0, MAX_NAME_LENGTH) : undefined,
      description:
        typeof body.description === "string" && !definition ? body.description.trim().slice(0, MAX_DESCRIPTION_LENGTH) : undefined,
      authType,
      endpoint,
      transport,
      credential: Object.keys(credential).length ? credential : null,
      hint: credentialHint(resolved, authType, credential) ?? null,
      status: row?.status === "connected" ? "connected" : "disconnected",
    });
    this.record(ownerId, connectorId, "connector.configure", true, `保存 ${authType} 配置`);
    return this.publicRecord(ownerId, this.definitionFor(saved), saved);
  }

  /** Create a connector the person defines themselves (MCP or webhook). */
  create(ownerId: string, body: Record<string, unknown>): ConnectorRecord {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new ConnectorInputError("请填写连接器名称。");
    if (name.length > MAX_NAME_LENGTH) throw new ConnectorInputError("连接器名称过长。");
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, MAX_DESCRIPTION_LENGTH) : "";
    const count = this.db
      .prepare("SELECT COUNT(*) AS n FROM connector_connections WHERE owner_id=? AND connector_id LIKE 'mcp-%'")
      .get(ownerId) as { n: number };
    if (count.n >= MAX_CUSTOM_CONNECTORS)
      throw new ConnectorInputError(`自定义连接器最多 ${MAX_CUSTOM_CONNECTORS} 个。`);
    const id = `mcp-${randomUUID()}`;
    const authType: ConnectorAuthType = body.authType === "webhook" ? "webhook" : "mcp";
    const endpoint = this.readEndpoint(body, null, authType);
    if (!endpoint) throw new ConnectorInputError("请先填写服务地址。");
    const saved = this.save(ownerId, id, {
      name,
      description: description || "自定义 MCP 连接器配置",
      provider: "custom",
      authType,
      status: "disconnected",
      endpoint,
      transport: body.transport === "sse" ? "sse" : "streamable-http",
    });
    this.record(ownerId, id, "connector.create", true, `创建自定义连接器（${authType}）`);
    return this.publicRecord(ownerId, synthesizeDefinition(saved), saved);
  }

  remove(ownerId: string, connectorId: string): boolean {
    const row = this.row(ownerId, connectorId);
    if (!row) return false;
    this.db.prepare("DELETE FROM connector_connections WHERE owner_id=? AND connector_id=?").run(ownerId, connectorId);
    this.record(ownerId, connectorId, "connector.delete", true, "删除配置");
    return true;
  }

  // -- verification ---------------------------------------------------------

  /**
   * Really dial the remote service. When `body` carries credentials they are
   * used for this check only; otherwise the saved credential is used.
   */
  async test(
    ownerId: string,
    connectorId: string,
    body: Record<string, unknown> = {},
  ): Promise<ConnectorTestResult> {
    const definition = findConnectorDefinition(connectorId);
    const row = this.row(ownerId, connectorId);
    const resolved = definition ?? synthesizeDefinition({
      connector_id: connectorId,
      name: row?.name ?? connectorId,
      description: row?.description ?? "",
      auth_type: row?.auth_type ?? "mcp",
    });
    const authType = resolveAuthType(resolved, row?.auth_type, body.authType);
    const saved = this.credentialOf(row);
    const credential = Object.keys(body).length
      ? { ...saved, ...this.readCredentials(resolved, authType, body, saved) }
      : saved;
    const endpoint = this.readEndpoint(body, row?.endpoint, authType) ?? undefined;
    const transport: ConnectorTransport | undefined =
      body.transport === "sse" ? "sse" : body.transport === "streamable-http" ? "streamable-http" : (row?.transport as ConnectorTransport | undefined);
    const outcome = await runProbe(resolved, authType, { endpoint, transport }, credential, {
      fetchImpl: this.fetchImpl,
      allowPrivate: this.allowPrivate,
      now: this.now(),
    });
    const checkedAt = this.now();
    this.save(ownerId, connectorId, {
      authType,
      endpoint: endpoint ?? row?.endpoint ?? null,
      transport: transport ?? (row?.transport as ConnectorTransport | null) ?? null,
      lastCheckedAt: checkedAt,
      lastError: outcome.ok ? null : outcome.detail.slice(0, 300),
    });
    this.record(ownerId, connectorId, "connector.test", outcome.ok, outcome.detail.slice(0, 200));
    return { ...outcome, connectorId, authType, checkedAt };
  }

  /**
   * Verify and only then connect. Credentials are persisted when the remote
   * service confirms they work, so `connected` always means "the server
   * talked to the service and it answered".
   */
  async connect(
    ownerId: string,
    connectorId: string,
    body: Record<string, unknown> = {},
  ): Promise<{ record: ConnectorRecord; result: ConnectorTestResult }> {
    const definition = findConnectorDefinition(connectorId);
    const row = this.row(ownerId, connectorId);
    const resolved = definition ?? synthesizeDefinition({
      connector_id: connectorId,
      name: row?.name ?? connectorId,
      description: row?.description ?? "",
      auth_type: row?.auth_type ?? "mcp",
    });
    const authType = resolveAuthType(resolved, row?.auth_type, body.authType);
    if (authType === "oauth") {
      // OAuth connections are established by the callback; here we only prove
      // that the stored token still works.
      if (!this.credentialOf(row).access_token)
        throw new ConnectorInputError("尚未完成 OAuth 授权，请先点击授权连接。");
      const result = await this.test(ownerId, connectorId, {});
      if (!result.ok) {
        this.save(ownerId, connectorId, { status: "error", lastError: result.detail.slice(0, 300) });
        return { record: this.publicRecord(ownerId, resolved, this.row(ownerId, connectorId)), result };
      }
      const saved = this.save(ownerId, connectorId, {
        status: "connected",
        lastError: null,
        connectedAt: new Date(result.checkedAt).toISOString(),
      });
      this.record(ownerId, connectorId, "connector.connect", true, "OAuth 令牌校验通过");
      return { record: this.publicRecord(ownerId, resolved, saved), result };
    }
    const savedCredential = this.credentialOf(row);
    const credential = { ...savedCredential, ...this.readCredentials(resolved, authType, body, savedCredential) };
    const endpoint = this.readEndpoint(body, row?.endpoint, authType) ?? undefined;
    const transport: ConnectorTransport | undefined =
      body.transport === "sse" ? "sse" : body.transport === "streamable-http" ? "streamable-http" : (row?.transport as ConnectorTransport | undefined);
    if (authTypeNeedsEndpoint(authType) && !endpoint)
      throw new ConnectorInputError("请先填写服务地址。");
    const outcome = await runProbe(resolved, authType, { endpoint, transport }, credential, {
      fetchImpl: this.fetchImpl,
      allowPrivate: this.allowPrivate,
      now: this.now(),
    });
    const checkedAt = this.now();
    const result: ConnectorTestResult = { ...outcome, connectorId, authType, checkedAt };
    if (!result.ok) {
      this.save(ownerId, connectorId, {
        authType,
        endpoint: endpoint ?? null,
        transport: transport ?? null,
        status: "error",
        lastError: result.detail.slice(0, 300),
        lastCheckedAt: checkedAt,
      });
      this.record(ownerId, connectorId, "connector.connect", false, result.detail.slice(0, 200));
      return { record: this.publicRecord(ownerId, resolved, this.row(ownerId, connectorId)), result };
    }
    const saved = this.save(ownerId, connectorId, {
      authType,
      endpoint: endpoint ?? null,
      transport: transport ?? null,
      credential: Object.keys(credential).length ? credential : null,
      hint: credentialHint(resolved, authType, credential) ?? null,
      status: "connected",
      lastError: null,
      lastCheckedAt: checkedAt,
      connectedAt: new Date(checkedAt).toISOString(),
      scopes: authType === "mcp" ? (result.tools ?? []).slice(0, 50) : [],
    });
    this.record(ownerId, connectorId, "connector.connect", true, result.detail.slice(0, 200));
    return { record: this.publicRecord(ownerId, resolved, saved), result };
  }

  /** Drop the credentials and, where the provider supports it, revoke the token. */
  async disconnect(ownerId: string, connectorId: string): Promise<ConnectorRecord> {
    const row = this.row(ownerId, connectorId);
    const definition = findConnectorDefinition(connectorId);
    const resolved = definition ?? synthesizeDefinition({
      connector_id: connectorId,
      name: row?.name ?? connectorId,
      description: row?.description ?? "",
      auth_type: row?.auth_type ?? "mcp",
    });
    const credential = this.credentialOf(row);
    if (credential.access_token && resolved.oauth?.revokeUrl) {
      await this.revoke(resolved, credential, connectorId, ownerId);
    }
    const saved = this.save(ownerId, connectorId, {
      status: "disconnected",
      credential: null,
      hint: null,
      connectedAt: null,
      lastError: null,
      scopes: [],
    });
    this.record(ownerId, connectorId, "connector.disconnect", true, "已断开连接");
    return this.publicRecord(ownerId, resolved, saved);
  }

  private async revoke(definition: ConnectorDefinition, credential: Credential, connectorId: string, ownerId: string) {
    const spec = definition.oauth;
    if (!spec?.revokeUrl) return;
    const clientId = process.env[spec.clientIdEnv]?.trim() || "";
    const clientSecret = process.env[spec.clientSecretEnv]?.trim() || "";
    try {
      const url = substitute(spec.revokeUrl, { ...credential, client_id: clientId });
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      };
      if (spec.tokenAuth === "basic" && clientId && clientSecret)
        headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
      const params = new URLSearchParams({ token: credential.access_token });
      if (spec.tokenAuth === "body" && clientId) {
        params.set("client_id", clientId);
        params.set("client_secret", clientSecret);
      }
      const method = spec.revokeMethod || "POST";
      await this.fetchImpl(url, {
        method,
        headers,
        ...(method === "GET" ? {} : { body: params.toString() }),
        signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
      });
    } catch {
      // Revocation is best effort: the local credential is dropped either way.
      this.record(ownerId, connectorId, "connector.revoke", false, "令牌撤销请求失败");
    }
  }

  // -- OAuth ---------------------------------------------------------------

  private publicOrigin(request: Request): string {
    const configured = process.env.DESIGNBUDDY_PUBLIC_ORIGIN?.trim().replace(/\/+$/, "");
    if (configured) return configured;
    const host = request.headers.get("host") || new URL(request.url).host;
    const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol =
      forwarded === "http" || forwarded === "https"
        ? forwarded
        : host.endsWith(".e2b.app")
          ? "https"
          : new URL(request.url).protocol.replace(":", "");
    return `${protocol}://${host}`;
  }

  /** Only in-app paths survive the OAuth round trip. */
  private sanitizeReturnTo(value: unknown): string {
    if (typeof value !== "string" || !value) return "/connectors/oauth";
    let path = value;
    try {
      const parsed = new URL(value, "https://placeholder.invalid");
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      return "/connectors/oauth";
    }
    if (path.length > 200 || /[\r\n\\]/.test(path)) return "/connectors/oauth";
    if (!path.startsWith("/") || path.startsWith("//")) return "/connectors/oauth";
    return path;
  }

  /** Build the provider authorization URL and remember the one-time state. */
  startOAuth(ownerId: string, connectorId: string, returnTo: string, request: Request) {
    const definition = findConnectorDefinition(connectorId);
    if (!definition?.oauth) throw new ConnectorInputError("该连接器不支持 OAuth 授权。");
    const spec = definition.oauth;
    const clientId = process.env[spec.clientIdEnv]?.trim();
    const clientSecret = process.env[spec.clientSecretEnv]?.trim();
    if (!clientId || !clientSecret)
      throw new ConnectorNotConfiguredError(
        `服务端尚未配置 ${spec.clientIdEnv} / ${spec.clientSecretEnv}，无法启动 OAuth 授权。`,
      );
    const state = randomBytes(32).toString("base64url");
    const usePkce = spec.pkce !== false;
    const codeVerifier = usePkce ? randomBytes(32).toString("base64url") : "";
    const now = this.now();
    this.db
      .prepare("DELETE FROM connector_oauth_states WHERE expires_at<?")
      .run(now);
    this.db
      .prepare(
        "INSERT INTO connector_oauth_states(state,owner_id,connector_id,return_to,code_verifier,created_at,expires_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(state, ownerId, connectorId, returnTo, codeVerifier, now, now + OAUTH_STATE_TTL_MS);
    const redirectUri = `${this.publicOrigin(request)}/api/connectors/oauth/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });
    if (spec.scopes.length) params.set("scope", spec.scopes.join(" "));
    for (const [key, value] of Object.entries(spec.authorizationParams || {})) params.set(key, value);
    if (usePkce) {
      const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
      params.set("code_challenge", challenge);
      params.set("code_challenge_method", "S256");
    }
    const authorizationUrl = `${spec.authorizationUrl}?${params.toString()}`;
    this.record(ownerId, connectorId, "connector.oauth.start", true, `跳转 ${new URL(spec.authorizationUrl).host}`);
    return { authorizationUrl, state, connectorId, expiresAt: now + OAUTH_STATE_TTL_MS };
  }

  /**
   * Exchange the code, verify the token against the real API, then connect.
   * `redirectUri` must be identical to the one used for the authorization
   * request - the single-use state row carries it, so nothing is shared
   * between concurrent flows.
   */
  async completeOAuth(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ returnTo: string; record: ConnectorRecord; ok: boolean; detail: string }> {
    const row = this.db
      .prepare("SELECT * FROM connector_oauth_states WHERE state=?")
      .get(state) as
      | { state: string; owner_id: string; connector_id: string; return_to: string; code_verifier: string; expires_at: number }
      | undefined;
    if (!row) throw new ConnectorInputError("授权状态不存在或已被使用。");
    // One-time use: delete first so a replay cannot exchange the code again.
    this.db.prepare("DELETE FROM connector_oauth_states WHERE state=?").run(state);
    const returnTo = row.return_to || "/connectors/oauth";
    if (row.expires_at < this.now())
      throw new ConnectorInputError("授权已超时，请重新开始授权。");
    const definition = findConnectorDefinition(row.connector_id);
    if (!definition?.oauth)
      throw new ConnectorInputError("该连接器不支持 OAuth 授权。");
    const token = await this.exchangeCode(definition, code, row.code_verifier, redirectUri);
    const credential: Credential = { access_token: token.access_token };
    if (token.refresh_token) credential.refresh_token = token.refresh_token;
    if (token.scope) credential.scope = token.scope;
    if (token.expires_at) credential.expires_at = token.expires_at;
    const outcome = await runProbe(definition, "oauth", {}, credential, {
      fetchImpl: this.fetchImpl,
      allowPrivate: this.allowPrivate,
      now: this.now(),
    });
    const scopes = token.scope ? token.scope.split(/[,\s]+/).filter(Boolean) : definition.oauth.scopes;
    if (!outcome.ok) {
      const saved = this.save(row.owner_id, row.connector_id, {
        authType: "oauth",
        status: "error",
        credential,
        hint: credentialHint(definition, "oauth", credential) ?? null,
        lastError: outcome.detail.slice(0, 300),
        lastCheckedAt: this.now(),
        scopes,
      });
      this.record(row.owner_id, row.connector_id, "connector.oauth.callback", false, outcome.detail.slice(0, 200));
      return { returnTo, record: this.publicRecord(row.owner_id, definition, saved), ok: false, detail: outcome.detail };
    }
    const saved = this.save(row.owner_id, row.connector_id, {
      authType: "oauth",
      status: "connected",
      credential,
      hint: credentialHint(definition, "oauth", credential) ?? null,
      lastError: null,
      lastCheckedAt: this.now(),
      connectedAt: new Date().toISOString(),
      scopes,
    });
    this.record(row.owner_id, row.connector_id, "connector.oauth.callback", true, "授权完成并通过真实校验");
    return { returnTo, record: this.publicRecord(row.owner_id, definition, saved), ok: true, detail: outcome.detail };
  }

  private async exchangeCode(
    definition: ConnectorDefinition,
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<{ access_token: string; refresh_token?: string; scope?: string; expires_at?: string }> {
    const spec = definition.oauth!;
    const clientId = process.env[spec.clientIdEnv]?.trim() || "";
    const clientSecret = process.env[spec.clientSecretEnv]?.trim() || "";
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
    });
    if (spec.tokenAuth === "body") params.set("client_secret", clientSecret);
    if (codeVerifier) params.set("code_verifier", codeVerifier);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (spec.tokenAuth === "basic")
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    const response = await this.fetchImpl(spec.tokenUrl, {
      method: "POST",
      headers,
      body: params.toString(),
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
    });
    const text = await readBody(response, 8192);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      try {
        parsed = Object.fromEntries(new URLSearchParams(text)) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }
    const accessToken = typeof parsed.access_token === "string" ? parsed.access_token : "";
    if (!accessToken) {
      const message =
        typeof parsed.error_description === "string"
          ? parsed.error_description
          : typeof parsed.error === "string"
            ? parsed.error
            : `令牌接口返回 HTTP ${response.status}`;
      throw new ConnectorInputError(`授权失败：${message}`);
    }
    return {
      access_token: accessToken,
      ...(typeof parsed.refresh_token === "string" ? { refresh_token: parsed.refresh_token } : {}),
      ...(typeof parsed.scope === "string" ? { scope: parsed.scope } : {}),
      ...(typeof parsed.expires_in === "number"
        ? { expires_at: new Date(Date.now() + parsed.expires_in * 1000).toISOString() }
        : {}),
    };
  }

  // -- HTTP ---------------------------------------------------------------

  async handle(request: Request, ownerId: string): Promise<Response | null> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const prefix = "/api/connectors";
    if (path !== prefix && !path.startsWith(prefix + "/")) return null;
    const rest = path.slice(prefix.length).replace(/^\//, "");
    const segments = rest ? rest.split("/") : [];

    try {
      if (!segments.length && method === "GET")
        return responseJSON(this.list(ownerId));

      if (segments.length === 1 && segments[0] === "catalog" && method === "GET")
        return responseJSON({ connectors: this.catalog(ownerId) });

      if (!segments.length && method === "POST") {
        if (!sameOrigin(request)) return responseJSON({ error: "跨站修改请求已拒绝。" }, 403);
        const body = await readJson(request);
        const record = this.create(ownerId, body);
        return responseJSON(record, 201);
      }

      // The provider redirects the browser back here: no session is required
      // because the one-time state carries the owner who started the flow.
      if (segments.length === 2 && segments[0] === "oauth" && segments[1] === "callback" && method === "GET") {
        const code = url.searchParams.get("code") || "";
        const state = url.searchParams.get("state") || "";
        const origin = this.publicOrigin(request);
        const redirectUri = `${origin}/api/connectors/oauth/callback`;
        let returnTo = "/connectors/oauth";
        try {
          const pending = this.db
            .prepare("SELECT return_to FROM connector_oauth_states WHERE state=?")
            .get(state) as { return_to: string } | undefined;
          if (pending) returnTo = pending.return_to || returnTo;
          if (!code || !state) throw new ConnectorInputError("授权回调缺少 code 或 state 参数。");
          const result = await this.completeOAuth(code, state, redirectUri);
          // No success flag is added: the browser re-reads the real status
          // from the server instead of trusting the URL it came back with.
          return redirectTo(`${origin}${result.returnTo}`);
        } catch (cause) {
          const message = cause instanceof ConnectorInputError ? cause.message : "授权回调处理失败。";
          return redirectTo(
            `${origin}${returnTo}${returnTo.includes("?") ? "&" : "?"}oauth_error=${encodeURIComponent(message.slice(0, 120))}`,
          );
        }
      }

      if (segments.length === 2 && segments[0] === "oauth" && segments[1] === "start" && method === "POST") {
        if (!sameOrigin(request)) return responseJSON({ error: "跨站修改请求已拒绝。" }, 403);
        if (this.rateLimited(ownerId, "oauth.start"))
          return responseJSON({ error: "授权请求过于频繁，请稍后再试。", code: "RATE_LIMITED" }, 429);
        const body = await readJson(request);
        const connectorId = resolveConnectorId(body);
        const returnTo = this.sanitizeReturnTo(body.returnTo);
        try {
          return responseJSON(this.startOAuth(ownerId, connectorId, returnTo, request));
        } catch (cause) {
          if (cause instanceof ConnectorNotConfiguredError)
            return responseJSON({ error: cause.message, code: "OAUTH_APP_NOT_CONFIGURED" }, 503);
          if (cause instanceof ConnectorInputError)
            return responseJSON({ error: cause.message, code: "INVALID_INPUT" }, 400);
          throw cause;
        }
      }

      const [connectorId, action] = segments;
      if (!connectorId || segments.length > 2) return responseJSON({ error: "接口不存在。" }, 404);
      if (!isValidConnectorId(connectorId)) return responseJSON({ error: "连接器标识无效。" }, 400);
      const exists = findConnectorDefinition(connectorId) || this.row(ownerId, connectorId);
      if (!exists) return responseJSON({ error: "未找到该连接器。", code: "NOT_FOUND" }, 404);

      if (!action && method === "GET") {
        const definition = findConnectorDefinition(connectorId);
        const row = this.row(ownerId, connectorId);
        return responseJSON(this.publicRecord(ownerId, definition ?? synthesizeDefinition(row ?? {
          connector_id: connectorId,
          name: connectorId,
          description: "",
          auth_type: "mcp",
        }), row));
      }
      if (action === "events" && method === "GET")
        return responseJSON({ events: this.events(ownerId, connectorId) });

      if (!action && method === "DELETE") {
        if (!sameOrigin(request)) return responseJSON({ error: "跨站修改请求已拒绝。" }, 403);
        if (findConnectorDefinition(connectorId))
          return responseJSON({ error: "内置连接器不能删除，可以断开连接。" }, 400);
        if (!this.remove(ownerId, connectorId))
          return responseJSON({ error: "未找到该连接器。", code: "NOT_FOUND" }, 404);
        return responseJSON({ ok: true }, 200);
      }

      if (!sameOrigin(request)) return responseJSON({ error: "跨站修改请求已拒绝。" }, 403);
      const body = await readJson(request, true);

      if (action === "configure" && method === "POST") {
        try {
          return responseJSON(this.configure(ownerId, connectorId, body));
        } catch (cause) {
          if (cause instanceof ConnectorInputError)
            return responseJSON({ error: cause.message, code: "INVALID_INPUT" }, 400);
          throw cause;
        }
      }

      if (action === "test" && method === "POST") {
        if (this.rateLimited(ownerId, "test"))
          return responseJSON({ error: "连通性测试过于频繁，请稍后再试。", code: "RATE_LIMITED" }, 429);
        try {
          const result = await this.test(ownerId, connectorId, body);
          return responseJSON(result, result.ok ? 200 : 502);
        } catch (cause) {
          if (cause instanceof ConnectorInputError)
            return responseJSON({ error: cause.message, code: "INVALID_INPUT" }, 400);
          throw cause;
        }
      }

      if (action === "connect" && method === "POST") {
        if (this.rateLimited(ownerId, "connect"))
          return responseJSON({ error: "连接请求过于频繁，请稍后再试。", code: "RATE_LIMITED" }, 429);
        try {
          const { record, result } = await this.connect(ownerId, connectorId, body);
          return responseJSON({ connector: record, result }, result.ok ? 200 : 502);
        } catch (cause) {
          if (cause instanceof ConnectorInputError)
            return responseJSON({ error: cause.message, code: "INVALID_INPUT" }, 400);
          throw cause;
        }
      }

      if (action === "disconnect" && method === "POST") {
        const record = await this.disconnect(ownerId, connectorId);
        return responseJSON({ connector: record });
      }

      return responseJSON({ error: "接口不存在。" }, 404);
    } catch (cause) {
      if (cause instanceof ConnectorInputError)
        return responseJSON({ error: cause.message, code: "INVALID_INPUT" }, 400);
      const message = cause instanceof Error ? cause.message : "连接器服务出错。";
      return responseJSON({ error: message, code: "CONNECTOR_ERROR" }, 500);
    }
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function redirectTo(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: location, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function readJson(request: Request, allowEmpty = false): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) {
    if (allowEmpty) return {};
    throw new ConnectorInputError("请求必须为 JSON 对象。");
  }
  if (Buffer.byteLength(text) > 64_000) throw new ConnectorInputError("请求内容超出大小限制。");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ConnectorInputError("请求必须为合法 JSON。");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ConnectorInputError("请求必须为 JSON 对象。");
  return value as Record<string, unknown>;
}

function safeJsonArray(value: string | undefined | null): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isAuthType(value: string): boolean {
  return ["oauth", "api_key", "webhook", "mcp"].includes(value);
}
function isStatus(value: string): boolean {
  return ["disconnected", "pending", "connected", "error"].includes(value);
}
function isTransport(value: string): boolean {
  return value === "streamable-http" || value === "sse";
}
function authTypeNeedsEndpoint(authType: ConnectorAuthType): boolean {
  return authType === "webhook" || authType === "mcp";
}
function resolveAuthType(definition: ConnectorDefinition, current: string | undefined, requested: unknown): ConnectorAuthType {
  if (typeof requested === "string" && (definition.authTypes as string[]).includes(requested))
    return requested as ConnectorAuthType;
  if (current && (definition.authTypes as string[]).includes(current)) return current as ConnectorAuthType;
  return definition.authTypes[0];
}
function isValidConnectorId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-_.]{0,63}$/i.test(value) && !value.includes("..");
}
/** The legacy `{ provider }` contract still resolves to the matching connector. */
function resolveConnectorId(body: Record<string, unknown>): string {
  const fromId = typeof body.connectorId === "string" ? body.connectorId : "";
  if (fromId) return fromId;
  const provider = typeof body.provider === "string" ? body.provider : "";
  const byProvider: Record<string, string> = {
    google: "gmail",
    github: "github",
    notion: "notion",
    microsoft: "outlook",
  };
  return byProvider[provider] || "";
}
