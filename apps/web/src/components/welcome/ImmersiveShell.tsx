import { useState, type ReactNode } from "react";
import {
  setLocale,
  usePreferences,
} from "../../../../../frontend/workspace/settingsStore";
import lake from "../../assets/welcome/gallery-lake.webp";
import { useWelcomeCopy, welcomeLanguages } from "./copy";
import "./welcome.css";

export default function ImmersiveShell({
  children,
  variant = "welcome",
}: {
  children: ReactNode;
  variant?: "welcome" | "auth";
}) {
  const copy = useWelcomeCopy();
  const locale = usePreferences((s) => s.locale);
  const [error, setError] = useState("");
  return (
    <main
      className={
        variant === "auth" ? "welcome-page welcome-page--auth" : "welcome-page"
      }
      style={{
        backgroundImage: `linear-gradient(90deg,rgba(12,30,32,.22),rgba(12,30,32,.08)),url("${lake}")`,
      }}
    >
      <section className="welcome-card" aria-label="DesignBuddy">
        <a className="welcome-brand" href="/welcome">
          <span aria-hidden="true">✧</span> DesignBuddy
          {variant === "auth" && (
            <small className="auth-brand-note">CREATIVE SPACE</small>
          )}
        </a>
        <div className="welcome-content">{children}</div>
        <footer className="welcome-footer">
          <label className="welcome-language">
            <span aria-hidden="true">◎</span>
            <select
              aria-label={copy.language}
              value={
                welcomeLanguages.some((l) => l.value === locale) ? locale : "en"
              }
              onChange={(e) => {
                try {
                  setLocale(e.target.value as typeof locale);
                  setError("");
                } catch {
                  setError(copy.storage);
                }
              }}
            >
              {welcomeLanguages.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <small>{copy.footer}</small>
          {error && <p role="alert">{error}</p>}
        </footer>
      </section>
      <aside className="welcome-art-caption">
        <span>ART MEETS POSSIBILITY</span>
        <p>{copy.art}</p>
        <small>DesignBuddy / Creative Space</small>
      </aside>
    </main>
  );
}
