import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * A failed route chunk used to blank the whole document.
 *
 * Every non-home route is a `React.lazy` import. When that import rejects — a
 * Vite restart, an "optimized dependencies changed" reload, a dev-server
 * restart under an open tab, or a dropped request behind the preview proxy —
 * React unmounts the tree and renders nothing at all: no message, no retry,
 * just a white screen that only a manual reload can clear.
 *
 * This boundary keeps the failure visible and recoverable. A stale-chunk
 * failure reloads the page once (the retry is guarded so a genuinely broken
 * build cannot loop); every other error shows what broke and offers a retry.
 */

const RELOAD_GUARD_KEY = "designbuddy.chunk-reload-at";
const RELOAD_WINDOW_MS = 10_000;

/** In-memory fallback for browsers that block sessionStorage (preview iframes). */
let lastReloadAt = 0;

function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message)
  );
}

/**
 * Reload at most once per window. Returns true when a reload was started, so
 * the caller knows not to bother painting an error screen first.
 */
function reloadOnceForStaleChunk(): boolean {
  const now = Date.now();
  if (now - lastReloadAt < RELOAD_WINDOW_MS) return false;
  lastReloadAt = now;
  try {
    const stored = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (stored && now - stored < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
  } catch {
    // Storage blocked: the in-memory guard above still stops a reload loop.
  }
  window.location.reload();
  return true;
}

interface RouteErrorBoundaryProps {
  children: ReactNode;
  /** Shown above the error so the user knows which screen failed. */
  label?: string;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[designbuddy] route failed to render", error, info.componentStack);
    if (isStaleChunkError(error)) reloadOnceForStaleChunk();
  }

  /**
   * `React.lazy` caches a rejected import, so simply clearing the error would
   * throw the same failure again. A stale chunk can only be recovered by
   * reloading the document; other errors are retried in place.
   */
  private retry = (): void => {
    if (isStaleChunkError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const staleChunk = isStaleChunkError(error);
    return (
      <div className="auth-loading route-error" role="alert">
        <p className="route-error-title">{this.props.label ?? "页面加载失败"}</p>
        <p className="route-error-detail">
          {staleChunk
            ? "页面组件没有加载成功，通常是后台正在重启或刚刚更新了代码。"
            : "页面在渲染时出错，其余功能未受影响。"}
        </p>
        <p className="route-error-message">{error.message || String(error)}</p>
        <div className="route-error-actions">
          <button type="button" onClick={this.retry}>
            重试
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      </div>
    );
  }
}
