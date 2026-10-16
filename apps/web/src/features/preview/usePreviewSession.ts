import { useCallback, useEffect, useRef, useState } from "react";

export type PreviewStatus = "idle" | "starting" | "ready" | "degraded" | "stopped" | "failed";
export type PreviewFramework = "react-vite" | "nextjs";

export interface PreviewFile {
  path: string;
  content: string;
}

export interface PreviewRuntimeError {
  id: string;
  name: string;
  message: string;
  stack?: string;
  source?: string;
  timestamp: number;
  fingerprint: string;
  count: number;
}

export interface PreviewSession {
  id: string;
  projectId: string;
  ownerId?: string;
  framework: PreviewFramework;
  status: Exclude<PreviewStatus, "idle">;
  version: number;
  previewUrl?: string;
  createdAt?: number;
  updatedAt?: number;
  lastHeartbeatAt?: number;
}

export interface PreviewEvent {
  sessionId: string;
  type: string;
  version: number;
  timestamp: number;
  payload?: Record<string, unknown>;
}

interface UsePreviewSessionOptions {
  projectId: string;
  files: PreviewFile[];
  framework?: PreviewFramework;
  apiBase?: string;
  initialSessionId?: string;
}

interface ApiErrorBody {
  message?: string;
  error?: string;
}

function normalizeBase(value: string): string {
  return value.replace(/\/+$/, "");
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({} as ApiErrorBody));
  if (!response.ok) {
    const info = body as ApiErrorBody;
    throw new Error(info.message || info.error || `Preview request failed with HTTP ${response.status}`);
  }
  return body as T;
}

function unwrapSession(body: unknown): PreviewSession {
  if (body && typeof body === "object" && "session" in body) {
    return (body as { session: PreviewSession }).session;
  }
  return body as PreviewSession;
}

export function usePreviewSession({
  projectId,
  files,
  framework = "react-vite",
  apiBase = "/api/preview",
  initialSessionId
}: UsePreviewSessionOptions) {
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [errors, setErrors] = useState<PreviewRuntimeError[]>([]);
  const [lastEvent, setLastEvent] = useState<PreviewEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const base = normalizeBase(apiBase);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(base + path, {
      credentials: "same-origin",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers
      }
    });
    return readResponse<T>(response);
  }, [base]);

  const loadErrors = useCallback(async (sessionId: string) => {
    try {
      const body = await request<PreviewRuntimeError[] | { errors: PreviewRuntimeError[] }>(
        `/sessions/${encodeURIComponent(sessionId)}/errors`
      );
      setErrors(Array.isArray(body) ? body : body.errors ?? []);
    } catch {
      // Error retrieval is supplemental; keep the preview itself usable.
    }
  }, [request]);

  const refreshSession = useCallback(async (sessionId?: string) => {
    const id = sessionId ?? session?.id ?? initialSessionId;
    if (!id) return null;
    const body = await request<PreviewSession | { session: PreviewSession }>(
      `/sessions/${encodeURIComponent(id)}`
    );
    const current = unwrapSession(body);
    setSession(current);
    setStatus(current.status);
    return current;
  }, [initialSessionId, request, session?.id]);

  const start = useCallback(async () => {
    if (!files.length) {
      setMessage("没有可预览的项目文件。请先生成或载入项目文件。");
      return null;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setStatus("starting");
    setMessage(null);
    try {
      const body = await request<PreviewSession | { session: PreviewSession }>("/sessions", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ projectId, framework, files })
      });
      const created = unwrapSession(body);
      setSession(created);
      setStatus(created.status);
      if (created.id) await loadErrors(created.id);
      return created;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "启动预览失败。");
      return null;
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setBusy(false);
    }
  }, [files, framework, loadErrors, projectId, request]);

  const update = useCallback(async (changedPaths?: string[]) => {
    const current = session;
    if (!current) {
      setMessage("请先启动预览。");
      return null;
    }
    if (!files.length) {
      setMessage("没有可提交的项目文件。");
      return null;
    }

    setBusy(true);
    setMessage(null);
    try {
      const paths = changedPaths?.length ? changedPaths : files.map((file) => file.path);
      const body = await request<PreviewSession | { session: PreviewSession }>(
        `/sessions/${encodeURIComponent(current.id)}/files`,
        {
          method: "PUT",
          body: JSON.stringify({ files, changedPaths: paths })
        }
      );
      const updated = unwrapSession(body);
      setSession(updated);
      setStatus(updated.status);
      return updated;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新预览失败。");
      setStatus("degraded");
      return null;
    } finally {
      setBusy(false);
    }
  }, [files, request, session]);

  const stop = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setMessage(null);
    try {
      await request<{ ok?: boolean }>(`/sessions/${encodeURIComponent(session.id)}`, {
        method: "DELETE"
      });
      setStatus("stopped");
      setSession((current) => current ? { ...current, status: "stopped" } : current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "停止预览失败。");
    } finally {
      setBusy(false);
    }
  }, [request, session]);

  const checkHealth = useCallback(async () => {
    if (!session) return;
    try {
      const body = await request<{ health?: { healthy: boolean }; status?: PreviewStatus }>(
        `/sessions/${encodeURIComponent(session.id)}/health`
      );
      if (body.status) setStatus(body.status);
      else if (body.health) setStatus(body.health.healthy ? "ready" : "degraded");
      await loadErrors(session.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法读取预览运行状态。");
    }
  }, [loadErrors, request, session]);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const dismissErrors = useCallback(() => setErrors([]), []);
  const clearMessage = useCallback(() => setMessage(null), []);

  useEffect(() => {
    if (!initialSessionId) return;
    let cancelled = false;
    void refreshSession(initialSessionId)
      .then((current) => {
        if (current && !cancelled) void loadErrors(current.id);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "读取预览会话失败。");
      });
    return () => { cancelled = true; };
  }, [initialSessionId, loadErrors, refreshSession]);

  useEffect(() => {
    if (!session?.id || status === "stopped" || status === "failed") {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    const source = new EventSource(
      base + `/sessions/${encodeURIComponent(session.id)}/events`,
      { withCredentials: true }
    );
    eventSourceRef.current?.close();
    eventSourceRef.current = source;

    const handle = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as PreviewEvent;
        setLastEvent(data);
        if (data.type === "session-ready" || data.type === "files-updated") {
          setStatus("ready");
          setSession((current) => current ? { ...current, version: data.version } : current);
          setRefreshKey((value) => value + 1);
        } else if (data.type === "runtime-health" && data.payload?.degraded === true) {
          setStatus("degraded");
        } else if (data.type === "runtime-error") {
          if (session?.id) void loadErrors(session.id);
        } else if (data.type === "session-stopped") {
          setStatus("stopped");
        }
      } catch {
        // Ignore malformed or unrelated events to keep the preview UI resilient.
      }
    };

    source.onmessage = handle;
    for (const type of ["session-ready", "files-updated", "runtime-health", "runtime-error", "session-stopped"]) {
      source.addEventListener(type, (event) => handle(event as MessageEvent<string>));
    }
    source.onerror = () => {
      // EventSource reconnects automatically; a transient connection loss is not fatal.
    };

    return () => {
      source.close();
      if (eventSourceRef.current === source) eventSourceRef.current = null;
    };
  }, [base, loadErrors, session?.id, status]);

  useEffect(() => () => {
    requestRef.current?.abort();
    eventSourceRef.current?.close();
  }, []);

  return {
    session,
    status,
    errors,
    lastEvent,
    busy,
    message,
    refreshKey,
    start,
    update,
    stop,
    refresh,
    checkHealth,
    dismissErrors,
    clearMessage,
    setMessage
  };
}
