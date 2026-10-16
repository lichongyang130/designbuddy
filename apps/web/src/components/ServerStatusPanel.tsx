import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiJSON, resetAPISession } from "../api/client";
import "../inspiration/template-cloud.css";
export function ServerDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
          ) || [],
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      className="server-panel-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="server-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="关闭服务器窗口" onClick={onClose}>
            关闭
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
type User = { id: string; username: string | null; kind: "guest" | "account" };
type Health = {
  ok: boolean;
  storage: string;
  capabilities: Record<string, boolean>;
};
export default function ServerStatusPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [health, setHealth] = useState<Health | null>(null),
    [user, setUser] = useState<User | null>(null),
    [message, setMessage] = useState("正在连接后台…"),
    [busy, setBusy] = useState(false),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  async function refresh() {
    try {
      const [h, me] = await Promise.all([
        apiJSON<Health>("/health"),
        apiJSON<{ user: User }>("/auth/me"),
      ]);
      setHealth(h);
      setUser(me.user);
      setMessage("后台已连接，数据存储为 SQLite。");
    } catch (e) {
      setHealth(null);
      setUser(null);
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function auth(action: "login" | "register") {
    setBusy(true);
    try {
      const result = await apiJSON<{ user: User }>(`/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      setUser(result.user);
      setPassword("");
      resetAPISession();
      setMessage(
        action === "register"
          ? "账号已创建；当前访客的服务器数据已归入这个账号。"
          : "已登录。请从服务器作品列表恢复内容；不会自动覆盖本机草稿。",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ServerDialog title="后台连接与账号" onClose={onClose}>
      <p className="server-panel-message" role="status">
        {message}
      </p>
      {health && (
        <>
          <dl>
            <dt>数据库</dt>
            <dd>{health.storage} · 已连接</dd>
            <dt>项目 / 模板备份</dt>
            <dd>已接通</dd>
            <dt>视频 MP4 转码</dt>
            <dd>
              {health.capabilities.videoTranscodeConfigured
                ? "FFmpeg 已就绪"
                : "未配置（可保留 WebM）"}
            </dd>
            <dt>AI 服务密钥</dt>
            <dd>
              {health.capabilities.aiConfigured
                ? "已配置，需实际请求验证"
                : "未配置，不会伪造回复"}
            </dd>
            <dt>连接器 / 支付 / 商家订单</dt>
            <dd>未接通</dd>
            <dt>当前身份</dt>
            <dd>{user?.username || "访客（当前浏览器）"}</dd>
          </dl>
          <p>
            这是当前服务器上的账号，不是第三方账号。访客 Cookie
            清除后不能自动找回服务器数据，建议注册后保存。注册账号可在另一设备登录同一服务器恢复作品。
          </p>
          {user?.kind === "guest" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void auth("login");
              }}
            >
              <label>
                用户名
                <input
                  aria-label="服务器用户名"
                  autoComplete="username"
                  pattern="[A-Za-z0-9_-]{3,40}"
                  minLength={3}
                  maxLength={40}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>
              <label>
                密码（10–128 位）
                <input
                  aria-label="服务器密码"
                  type="password"
                  autoComplete="current-password"
                  minLength={10}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <div className="server-panel-actions">
                <button disabled={busy} type="submit">
                  登录账号
                </button>
                <button
                  disabled={busy || username.length < 3 || password.length < 10}
                  type="button"
                  onClick={() => void auth("register")}
                >
                  注册并保留访客数据
                </button>
              </div>
            </form>
          ) : (
            <button
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    "退出服务器账号？当前设备的本地草稿仍会保留，请在公共设备上自行管理隐私。",
                  )
                )
                  return;
                setBusy(true);
                try {
                  await apiJSON("/auth/logout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                  });
                  resetAPISession();
                  await refresh();
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              退出服务器账号
            </button>
          )}
          <p>
            当前不提供邮件验证、密码找回、正式套餐或第三方单点登录。请保留导出备份，不要将此预览当作已完成安全审计的生产部署。
          </p>
        </>
      )}
      <div className="server-panel-actions">
        <button disabled={busy} onClick={() => void refresh()}>
          重新检查连接
        </button>
      </div>
    </ServerDialog>
  );
}
