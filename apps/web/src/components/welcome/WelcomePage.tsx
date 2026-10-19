import { useState } from "react";
import { sanitizeNext } from "../../../../../frontend/workspace/api/auth";
import ImmersiveShell from "./ImmersiveShell";
import { useWelcomeCopy } from "./copy";
import { OAuthButtons } from "../LoginPage";

export default function WelcomePage({
  next = new URLSearchParams(window.location.search).get("next") || "/",
  onEnter,
  backendUnavailable = false,
}: {
  next?: string;
  backendUnavailable?: boolean;
  onEnter: (settings?: boolean) => void;
}) {
  const c = useWelcomeCopy();
  const [notice, setNotice] = useState("");
  const destination = sanitizeNext(next);
  return (
    <ImmersiveShell>
      <p className="welcome-eyebrow">{c.eyebrow}</p>
      <h1 aria-label={c.title}>
        {c.title.includes("，")
          ? c.title.split("，").map((line, i) => (
              <span key={i} style={{ display: "block" }}>
                {line}
                {i === 0 ? "，" : ""}
              </span>
            ))
          : c.title}
      </h1>
      <p className="welcome-subtitle">{c.subtitle}</p>
      <a
        className="welcome-primary"
        href={`/login?next=${encodeURIComponent(destination)}`}
      >
        {c.start}
        <span aria-hidden="true">→</span>
      </a>
      <OAuthButtons mode="login" next={destination} onNotice={setNotice} />
      {(notice || backendUnavailable) && (
        <p role="alert" className="welcome-notice">
          {notice || c.connection}
        </p>
      )}
      <div className="welcome-divider">{c.alternative}</div>
      <div className="welcome-methods">
        <button onClick={() => onEnter(true)}>
          <span aria-hidden="true">▣</span>
          <span>
            <b>{c.local}</b>
            <small>{c.localHint}</small>
          </span>
          <i aria-hidden="true">↗</i>
        </button>
        <button onClick={() => onEnter(true)}>
          <span aria-hidden="true">⚿</span>
          <span>
            <b>{c.api}</b>
            <small>{c.apiHint}</small>
          </span>
          <i aria-hidden="true">↗</i>
        </button>
      </div>
      <button className="welcome-guest" onClick={() => onEnter()}>
        {c.guest} <span aria-hidden="true">→</span>
      </button>
    </ImmersiveShell>
  );
}
