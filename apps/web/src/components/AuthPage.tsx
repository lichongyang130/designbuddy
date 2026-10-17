import { useState } from "react";
import { HomeIcon } from "./HomeIcon";
import "./auth.css";

type AuthMode = "login" | "register";

export default function AuthPage() {
  console.log("✅ AuthPage component rendered!");
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = () => {
    if (!phone || phone.length < 11) return;
    setCodeSent(true);
    setCountdown(60);
    
    // Simulate countdown
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log({ mode, phone, code });
  };

  const handleOAuth = (provider: "google" | "github") => {
    // Handle OAuth login/register
    console.log(`OAuth ${mode} with ${provider}`);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <HomeIcon name="assistant" size={48} />
          </div>
          <h1 className="auth-title">
            {mode === "login" ? "欢迎回来" : "创建账号"}
          </h1>
          <p className="auth-subtitle">
            {mode === "login" 
              ? "登录您的账户以继续使用" 
              : "注册以开始使用所有功能"}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            登录
          </button>
          <button
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            注册
          </button>
        </div>

        <div className="auth-methods">
          <button
            className="auth-oauth-btn google"
            onClick={() => handleOAuth("google")}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
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
            <span>{mode === "login" ? "使用 Google 登录" : "使用 Google 注册"}</span>
          </button>

          <button
            className="auth-oauth-btn github"
            onClick={() => handleOAuth("github")}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>{mode === "login" ? "使用 GitHub 登录" : "使用 GitHub 注册"}</span>
          </button>
        </div>

        <div className="auth-divider">
          <span>或使用手机号</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="phone">手机号</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-prefix">+86</span>
              <input
                id="phone"
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                maxLength={11}
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="code">验证码</label>
            <div className="auth-input-wrapper">
              <input
                id="code"
                type="text"
                placeholder="请输入验证码"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
              />
              <button
                type="button"
                className="auth-send-code"
                onClick={handleSendCode}
                disabled={countdown > 0 || phone.length < 11}
              >
                {countdown > 0 ? `${countdown}s` : codeSent ? "重新发送" : "获取验证码"}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit" disabled={!phone || !code}>
            {mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {mode === "login" ? "还没有账号？" : "已有账号？"}
            <button
              type="button"
              className="auth-switch"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "立即注册" : "立即登录"}
            </button>
          </p>
          <p className="auth-terms">
            继续即表示您同意我们的{" "}
            <a href="#terms">服务条款</a> 和 <a href="#privacy">隐私政策</a>
          </p>
        </div>
      </div>
    </div>
  );
}
