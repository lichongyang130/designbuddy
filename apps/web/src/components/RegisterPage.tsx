import { useState, type FormEvent } from "react";
import {
  registerWithPassword,
  sanitizeNext,
} from "../../../../frontend/workspace/api/auth";
import { AuthShowcase, OAuthButtons } from "./LoginPage";
import "./auth.css";

export default function RegisterPage({ next: nextProp }: { next?: string } = {}) {
  const query = new URLSearchParams(window.location.search);
  const next = sanitizeNext(nextProp ?? query.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const mismatch = confirm.length > 0 && confirm !== password;
  const valid =
    username.trim().length >= 3 &&
    password.length >= 10 &&
    password.length <= 128 &&
    !mismatch &&
    confirm.length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError("");
    try {
      await registerWithPassword(username.trim().toLowerCase(), password);
      window.location.assign(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "注册失败，请重试。");
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthShowcase />
      <main className="auth-panel">
        <div className="auth-card">
          <h1>创建账号</h1>
          <p className="auth-sub">注册后即可免费开始使用全部功能</p>
          <OAuthButtons mode="register" next={next} onNotice={setError} />
          <div className="auth-divider" aria-hidden="true">
            <span>或使用用户名注册</span>
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
                autoComplete="new-password"
                placeholder="10–128 位密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={10}
                maxLength={128}
              />
            </label>
            <label className="auth-field">
              <span>确认密码</span>
              <input
                type="password"
                name="confirm"
                autoComplete="new-password"
                placeholder="再次输入密码"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={10}
                maxLength={128}
              />
            </label>
            {mismatch && (
              <p className="auth-error" role="alert">
                两次输入的密码不一致。
              </p>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth-submit" disabled={busy || !valid}>
              {busy ? "正在注册…" : "注册并登录"}
            </button>
          </form>
          <p className="auth-switch">
            已有账号？
            <a href={`/login?next=${encodeURIComponent(next)}`}>立即登录</a>
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
