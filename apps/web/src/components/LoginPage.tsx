import { useEffect, useState, type FormEvent } from "react";
import {
  fetchOAuthProviders,
  loginWithPassword,
  sanitizeNext,
  startOAuth,
  type OAuthProvider,
} from "../../../../frontend/workspace/api/auth";
import "./auth.css";

const providerNames: Record<OAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
};

const oauthErrors: Record<string, string> = {
  denied: "你取消了第三方授权，可以重试或使用账号密码登录。",
  not_configured: "服务器尚未配置第三方登录，请使用账号密码登录。",
  invalid_state: "登录会话已过期，请重新点击登录按钮。",
  missing_code: "没有收到授权码，请重试。",
  rate_limited: "操作过于频繁，请一分钟后重试。",
  disabled: "该账号已被管理员停用，请联系管理员。",
  exchange_failed: "第三方登录失败，请重试或使用账号密码登录。",
};

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export function OAuthButtons({
  mode,
  next,
  onNotice,
}: {
  mode: "login" | "register";
  next: string;
  onNotice: (message: string) => void;
}) {
  const [providers, setProviders] = useState<Record<
    OAuthProvider,
    boolean
  > | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchOAuthProviders()
      .then((result) => {
        if (!cancelled) setProviders(result);
      })
      .catch(() => {
        if (!cancelled)
          setProviders({ google: false, github: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const verb = mode === "login" ? "登录" : "注册";
  function attempt(provider: OAuthProvider) {
    if (!providers) {
      onNotice("正在加载登录选项，请稍候再试。");
      return;
    }
    if (!providers[provider]) {
      onNotice(
        `服务器尚未配置 ${providerNames[provider]} ${verb}，请使用账号密码${verb}，或联系管理员配置。`,
      );
      return;
    }
    onNotice("");
    startOAuth(provider, next);
  }
  return (
    <div className="auth-oauth">
      <button
        type="button"
        className={`auth-oauth-btn${providers && !providers.google ? " is-unconfigured" : ""}`}
        onClick={() => attempt("google")}
      >
        <GoogleGlyph />
        <span>使用 Google {verb}</span>
        {providers && !providers.google && (
          <small>未配置</small>
        )}
      </button>
      <button
        type="button"
        className={`auth-oauth-btn${providers && !providers.github ? " is-unconfigured" : ""}`}
        onClick={() => attempt("github")}
      >
        <GitHubGlyph />
        <span>使用 GitHub {verb}</span>
        {providers && !providers.github && (
          <small>未配置</small>
        )}
      </button>
    </div>
  );
}

export function AuthShowcase() {
  return (
    <div className="auth-showcase">
      <div className="auth-showcase-brand">
        <strong>DesignBuddy</strong>
        <span>设计 AI 工作台</span>
      </div>
      <h2>
        把想法变成
        <br />
        可以交付的作品
      </h2>
      <ul>
        <li>
          <strong>文档 / 幻灯片 / 数据看板</strong>
          <span>一句话描述需求，自动生成初稿并支持反复修改</span>
        </li>
        <li>
          <strong>专家与技能市场</strong>
          <span>按场景匹配专家角色与可执行技能，流程透明可追溯</span>
        </li>
        <li>
          <strong>本地优先，数据可控</strong>
          <span>草稿默认保存在本机，上传服务器的每一步都由你确认</span>
        </li>
      </ul>
      <p className="auth-showcase-foot">登录后即可创建任务、管理工作空间与作品库。</p>
    </div>
  );
}

export default function LoginPage({ next: nextProp }: { next?: string } = {}) {
  const query = new URLSearchParams(window.location.search);
  const next = sanitizeNext(nextProp ?? query.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    query.get("oauth") === "error"
      ? oauthErrors[query.get("reason") || ""] ||
          "第三方登录失败，请重试或使用账号密码登录。"
      : "",
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await loginWithPassword(username.trim(), password);
      window.location.assign(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败，请重试。");
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthShowcase />
      <main className="auth-panel">
        <div className="auth-card">
          <h1>欢迎回来</h1>
          <p className="auth-sub">登录 DesignBuddy，继续你的工作</p>
          <OAuthButtons mode="login" next={next} onNotice={setError} />
          <div className="auth-divider" aria-hidden="true">
            <span>或使用账号密码</span>
          </div>
          <form className="auth-form" onSubmit={submit}>
            <label className="auth-field">
              <span>用户名</span>
              <input
                type="text"
                name="username"
                autoComplete="username"
                placeholder="3–40 位字母 / 数字 / 下划线"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={3}
                maxLength={40}
              />
            </label>
            <label className="auth-field">
              <span>密码</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="10–128 位密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={10}
                maxLength={128}
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="auth-submit"
              disabled={busy || username.trim().length < 3 || password.length < 10}
            >
              {busy ? "正在登录…" : "登录"}
            </button>
          </form>
          <p className="auth-switch">
            还没有账号？
            <a href={`/register?next=${encodeURIComponent(next)}`}>立即注册</a>
          </p>
          <p className="auth-terms">
            继续即表示你同意我们的 <a href="#terms">服务条款</a> 和{" "}
            <a href="#privacy">隐私政策</a>
          </p>
        </div>
      </main>
    </div>
  );
}
