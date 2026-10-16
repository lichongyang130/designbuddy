const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(
  /\/+$/,
  "",
);
export const API_BASE = configuredBase
  ? configuredBase.endsWith("/api")
    ? configuredBase
    : `${configuredBase}/api`
  : "/api";
let session: Promise<void> | undefined;
export function resetAPISession() {
  session = undefined;
  window.dispatchEvent(new Event("designbuddy:server-identity"));
}
async function ensureSession() {
  if (API_BASE !== "/api") return;
  if (!session)
    session = (async () => {
      const response = await fetch("/api/local/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await readJSON<{ authenticated?: boolean }>(response);
      if (body?.authenticated !== true)
        throw Error("服务器没有确认会话，请检查后台连接。");
    })().catch((error) => {
      session = undefined;
      throw error;
    });
  return session;
}
/** Never interpret the SPA HTML fallback as a successful API result. */
export async function readJSON<T>(response: Response): Promise<T> {
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Error(
      `接口没有返回 JSON（HTTP ${response.status}），请检查后台服务和代理。`,
    );
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(
      typeof body?.error === "string"
        ? body.error
        : `请求失败（HTTP ${response.status}）`,
    ) as Error & { status: number; code?: string };
    error.status = response.status;
    error.code = body?.code;
    throw error;
  }
  return body as T;
}
type APIRequestInit = RequestInit & { retryOnIdentityChange?: boolean };
export async function apiFetch(
  path: string,
  init: APIRequestInit = {},
): Promise<Response> {
  await ensureSession();
  const { retryOnIdentityChange, ...fetchInit } = init;
  const send = () =>
    fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
      ...fetchInit,
      credentials: "include",
    });
  let response = await send();
  // Authentication happens before business handlers. Retry once only for expired sessions,
  // never for bad login credentials, requests using external auth, or consumed streams.
  if (
    response.status === 401 &&
    API_BASE === "/api" &&
    !(init.body instanceof ReadableStream)
  ) {
    const expired =
      !path.startsWith("/auth/") ||
      (
        await response
          .clone()
          .json()
          .catch(() => ({}))
      ).code === "SESSION_REQUIRED";
    if (expired) {
      session = undefined;
      await ensureSession();
      window.dispatchEvent(new Event("designbuddy:server-identity"));
      if (retryOnIdentityChange === false) throw Error("服务端身份已变化，请重新核对材料并确认操作；未在新身份下自动重试。");
      response = await send();
    }
  }
  return response;
}
export async function apiJSON<T>(
  path: string,
  init: APIRequestInit = {},
): Promise<T> {
  return readJSON<T>(await apiFetch(path, init));
}

/** Read-only public endpoints such as the skill catalogue must remain visible before a guest session is established. */
export async function apiPublicJSON<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD")
    throw new Error("Public API helper only permits read-only requests.");
  const response = await fetch(
    `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
    { ...init, method, credentials: "omit" },
  );
  return readJSON<T>(response);
}
