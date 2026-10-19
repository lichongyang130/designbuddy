import { useEffect, useState, type FormEvent } from "react";
import {
  fetchOAuthProviders,
  loginWithPassword,
  registerWithPassword,
  sanitizeNext,
  startOAuth,
  type OAuthProvider,
} from "../../../../frontend/workspace/api/auth";
import ImmersiveShell from "./welcome/ImmersiveShell";
import { useWelcomeCopy } from "./welcome/copy";
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
  mode: _mode,
  next,
  onNotice,
}: {
  mode: "login" | "register";
  next: string;
  onNotice: (message: string) => void;
}) {
  const c = useWelcomeCopy();
  const [providers, setProviders] = useState<Record<
    OAuthProvider,
    boolean
  > | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setProviders(null);
    fetchOAuthProviders()
      .then((p) => {
        if (!cancelled) setProviders(p);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  function signIn(provider: OAuthProvider) {
    if (failed) {
      onNotice(c.connection);
      return;
    }
    if (!providers) {
      onNotice(c.loading);
      return;
    }
    if (!providers[provider]) {
      onNotice(c.unavailable);
      return;
    }
    onNotice("");
    startOAuth(provider, sanitizeNext(next));
  }
  return (
    <div className="welcome-oauth">
      {(["google", "github"] as const).map((provider) => (
        <button type="button" key={provider} onClick={() => signIn(provider)}>
          {provider === "google" ? <GoogleGlyph /> : <GitHubGlyph />}
          <span>{provider === "google" ? c.google : c.github}</span>
          {providers && !providers[provider] && <small>{c.unconfigured}</small>}
        </button>
      ))}
      {failed && (
        <button
          type="button"
          onClick={() => {
            setAttempt((a) => a + 1);
            onNotice("");
          }}
        >
          {c.connection} · {c.retry}
        </button>
      )}
    </div>
  );
}

export function AuthFormPage({
  mode = "login",
  next: nextProp,
}: {
  mode?: "login" | "register";
  next?: string;
}) {
  const c = useWelcomeCopy(),
    isRegister = mode === "register";
  const query = new URLSearchParams(window.location.search),
    next = sanitizeNext(nextProp ?? query.get("next"));
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mismatch = isRegister && confirm.length > 0 && confirm !== password;
  const valid =
    /^[a-zA-Z0-9_-]{3,40}$/.test(username.trim()) &&
    password.length >= 10 &&
    password.length <= 128 &&
    (!isRegister || confirm === password);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError("");
    try {
      if (isRegister)
        await registerWithPassword(username.trim().toLowerCase(), password);
      else await loginWithPassword(username.trim(), password);
      window.location.assign(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : c.failed);
      setBusy(false);
    }
  }
  return (
    <ImmersiveShell>
      <a
        className="welcome-back"
        href={`/welcome?next=${encodeURIComponent(next)}`}
      >
        ← {c.back}
      </a>
      <h1 className="welcome-form-title">
        {isRegister ? c.registerTitle : c.loginTitle}
      </h1>
      <p className="welcome-subtitle">
        {isRegister ? c.registerSub : c.loginSub}
      </p>
      <OAuthButtons mode={mode} next={next} onNotice={setError} />
      <div className="welcome-divider">{c.divider}</div>
      <form className="welcome-form" onSubmit={submit}>
        <label>
          {c.username}
          <input
            name="username"
            autoComplete="username"
            placeholder={c.usernameHint}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={40}
            pattern="[a-zA-Z0-9_-]{3,40}"
          />
        </label>
        <label>
          {c.password}
          <input
            type="password"
            name="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder={c.passwordHint}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            maxLength={128}
          />
        </label>
        {isRegister && (
          <label>
            {c.confirm}
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={10}
              maxLength={128}
              aria-invalid={mismatch}
            />
          </label>
        )}
        {mismatch && (
          <p className="welcome-notice" role="alert">
            {c.mismatch}
          </p>
        )}
        {(error || query.get("oauth") === "error") && (
          <p className="welcome-notice" role="alert">
            {error || c.oauthError}
          </p>
        )}
        <button
          type="submit"
          className="welcome-primary"
          disabled={busy || !valid}
        >
          {busy ? c.busy : isRegister ? c.register : c.login}
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <p className="welcome-switch">
        {isRegister ? c.hasAccount : c.newAccount}{" "}
        <a
          href={`/${isRegister ? "login" : "register"}?next=${encodeURIComponent(next)}`}
        >
          {isRegister ? c.toLogin : c.toRegister}
        </a>
      </p>
    </ImmersiveShell>
  );
}
export default function LoginPage({ next }: { next?: string } = {}) {
  return <AuthFormPage next={next} />;
}
