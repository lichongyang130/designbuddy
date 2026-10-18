import { apiJSON, resetAPISession } from "../api/client";
import { useId, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { openSettings, usePreferences, type SettingsSection } from "../../../../frontend/workspace/settingsStore";
import { translate } from "../../../../frontend/workspace/i18n";
import { AUTH_GATE_ENABLED } from "../../../../frontend/workspace/authGate";
import { HomeIcon, type HomeIconName } from "./HomeIcon";
import avatarImage from "../assets/home-avatar.png";
import "./account-menu.css";

type Identity = { username: string | null; displayName?: string; kind: "account" | "guest" };
type Detail = "fuel" | "invite" | "growth" | "feedback" | "updates" | "logout";
const details: Record<Detail, { titleKey: string; textKey: string }> = {
  fuel: { titleKey: "account.detail.fuel.t", textKey: "account.detail.fuel.x" },
  invite: { titleKey: "account.detail.invite.t", textKey: "account.detail.invite.x" },
  growth: { titleKey: "account.detail.growth.t", textKey: "account.detail.growth.x" },
  feedback: { titleKey: "account.detail.feedback.t", textKey: "account.detail.feedback.x" },
  updates: { titleKey: "account.detail.updates.t", textKey: "account.detail.updates.x" },
  logout: { titleKey: "account.detail.logout.t", textKey: "account.detail.logout.x" },
};
const feedbackKey = "designbuddy.feedback-draft.v1";
function readFeedback() {
  try { return (localStorage.getItem(feedbackKey) || "").slice(0, 4000); } catch { return ""; }
}
function maskName(name: string) { return /^\d{11}$/.test(name) ? `${name.slice(0, 3)}****${name.slice(-4)}` : name; }

/** Reference account menu; unavailable services are explicit, not simulated. */
export function AccountMenu() {
  const id = useId();
  const locale = usePreferences((state) => state.locale);
  const theme = usePreferences((state) => state.theme);
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, key, params);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [identityError, setIdentityError] = useState(false);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState(readFeedback);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const mounted = useRef(true);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // The server's profile wins; the reference phone number is only a guest placeholder.
  const displayName = identity?.displayName || identity?.username || "19932101651";
  useEffect(() => {
    mounted.current = true;
    let active = true, generation = 0;
    const refresh = () => {
      const attempt = ++generation;
      void apiJSON<{ user: Identity }>("/auth/me").then(data => {
        if (!data.user || !["guest", "account"].includes(data.user.kind) || !(data.user.username === null || typeof data.user.username === "string")) throw Error("账号信息格式无效");
        if (active && generation === attempt) { setIdentity(data.user); setIdentityError(false); }
      }).catch(() => { if (active && generation === attempt) { setIdentity(null); setIdentityError(true); } });
    };
    refresh();
    window.addEventListener("designbuddy:server-identity", refresh);
    return () => { active = false; mounted.current = false; window.removeEventListener("designbuddy:server-identity", refresh); };
  }, []);
  function close(restoreFocus = false) { setOpen(false); if (restoreFocus) trigger.current?.focus({ preventScroll: true }); }
  function settings(section: SettingsSection) { close(); openSettings(section, trigger.current); }
  function show(view: Detail) { setMessage(""); setDetail(view); }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      const x = viewport?.offsetLeft || 0, y = viewport?.offsetTop || 0;
      const above = anchor.top - y - 8, below = y + height - anchor.bottom - 8;
      const upwards = above >= 180 || above >= below;
      panel.current.style.maxHeight = `${Math.max(100, Math.min(height - 16, upwards ? above : below))}px`;
      const box = panel.current.getBoundingClientRect();
      setPosition({ left: Math.max(x + 8, Math.min(anchor.left - 8, x + width - box.width - 8)), top: Math.max(y + 8, Math.min(upwards ? anchor.top - box.height - 8 : anchor.bottom + 8, y + height - box.height - 8)) });
    };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close();
    };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(true); } };
    place(); panel.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(place); if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place); window.visualViewport?.addEventListener("scroll", place);
    document.addEventListener("pointerdown", outside); document.addEventListener("focusin", outside); document.addEventListener("keydown", escape);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); window.visualViewport?.removeEventListener("resize", place); window.visualViewport?.removeEventListener("scroll", place); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  useLayoutEffect(() => {
    if (open) { panel.current?.scrollTo(0, 0); panel.current?.focus({ preventScroll: true }); }
  }, [detail, open]);
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("input,textarea,select")) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []);
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (index + 1) % buttons.length : (index < 0 ? buttons.length - 1 : (index + buttons.length - 1) % buttons.length);
    buttons[next]?.focus();
  }
  async function logout() {
    if (sending.current || identity?.kind !== "account") return;
    sending.current = true; setBusy(true); setMessage("");
    try {
      const result = await apiJSON<{ ok: boolean }>("/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (result.ok !== true) throw Error(t("account.logout.serverFail"));
      resetAPISession();
      window.location.assign("/login");
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : t("account.logout.fail")); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  }
  function row(label: string, icon: HomeIconName, action: () => void, extra?: string, promo = false, arrow = false, dot = false) {
    return <button className={`account-action${promo ? " account-action-promo" : ""}`} aria-label={label} onClick={action}><HomeIcon name={icon} size={17} /><span>{label}</span>{extra && <small>{dot && <i aria-hidden="true" />}{extra}</small>}{arrow && <HomeIcon name="chevron" size={12} />}</button>;
  }
  return <>
    <button ref={trigger} className="profile-trigger" title={t("account.menu")} aria-label={t("account.menuFor", { name: displayName })} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { if (open) close(); else { setDetail(null); setMessage(""); setOpen(true); } }}>
      <img className="profile-avatar" src={avatarImage} alt="" width="33" height="33" /><strong>{displayName}</strong>
    </button>
    {open && createPortal(<div ref={panel} id={id} role="dialog" aria-label={t("account.menu")} tabIndex={-1} className="account-popover account-reference-menu" style={position} onKeyDown={keyboard}>
      {detail ? <section className="account-detail">
        <header><button aria-label={t("account.back")} onClick={() => { setDetail(null); setMessage(""); }}><HomeIcon name="chevron" /></button><h2>{t(details[detail].titleKey)}</h2><button aria-label={t("account.close")} onClick={() => close(true)}>×</button></header>
        <p>{t(details[detail].textKey)}</p>
        {detail === "feedback" && <>
          <label className="account-feedback-label">{t("account.feedback.label")}<textarea aria-label={t("account.feedback.label")} value={feedback} maxLength={4000} rows={6} placeholder={t("account.feedback.ph")} onChange={event => {
            const text = event.target.value; setFeedback(text);
            try { localStorage.setItem(feedbackKey, text); setMessage(t("account.feedback.draft")); }
            catch { setMessage(t("account.feedback.storageFail")); }
          }} /></label>
          <div className="account-detail-actions"><button disabled={!feedback.trim()} onClick={async () => {
            try { await navigator.clipboard.writeText(feedback); if (mounted.current) setMessage(t("account.feedback.copied")); }
            catch { if (mounted.current) setMessage(t("account.feedback.copyFail")); }
          }}>{t("account.feedback.copy")}</button><button disabled={!feedback.trim()} onClick={() => {
            const url = URL.createObjectURL(new Blob([`${t("account.feedback.fileHead")}\n\n${feedback}`], { type: "text/plain;charset=utf-8" }));
            const link = document.createElement("a"); link.href = url; link.download = t("account.feedback.file"); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage(t("account.feedback.downloaded"));
          }}>{t("account.feedback.download")}</button></div>
        </>}
        {detail === "logout" && <div className="account-detail-actions"><button onClick={() => { setDetail(null); setMessage(""); }}>{t("account.logout.cancel")}</button><button className="is-primary" disabled={busy || identity?.kind !== "account"} onClick={() => void logout()}>{busy ? t("account.logout.busy") : t("account.logout.confirm")}</button></div>}
        {detail === "fuel" && <div className="account-detail-actions"><button onClick={() => settings("plan")}>{t("account.plan.view")}</button></div>}
      </section> : <>
        <div className="account-identity"><img src={avatarImage} alt="" width="40" height="40" /><div><strong title={maskName(displayName)}>{maskName(displayName)}</strong><small>{identityError ? t("account.identity.error") : !identity ? t("account.identity.loading") : identity.kind === "account" ? t("account.identity.account") : t("account.identity.guest")}</small></div></div>
        <section className="account-plan" aria-label={t("account.plan")}><div><span>{t("account.plan.name")}</span><strong>{t("account.plan.none")}</strong><button className="account-upgrade" title={t("account.plan.upgrade.title")} onClick={() => settings("plan")}>{t("account.plan.upgrade")}</button></div><div><span>{t("account.plan.credits")}</span><strong aria-label={t("account.plan.credits.na")}>—</strong><button className="account-purchase" disabled title={t("account.plan.buy.title")}>{t("account.plan.buy")}</button></div></section>
        <div className="account-actions">
          {row(t("account.row.fuel"), "fuel", () => show("fuel"), undefined, true, true)}
          {row(t("account.row.invite"), "invite", () => show("invite"), t("account.row.pending"), true, true)}
          {row(t("account.row.growth"), "growth", () => show("growth"), t("account.row.pending"), true, true)}
          <div className="account-separated">
            {row(t("account.row.settings"), "settings", () => settings("general"), "⌘ ,")}
            {row(t("account.row.appearance"), "palette", () => settings("appearance"), t(`settings.appearance.theme.${theme}`), false, true, true)}
            {row(t("account.row.memory"), "bulb", () => settings("memory"))}
            {row(t("account.row.feedback"), "help", () => show("feedback"))}
            {row(t("account.row.updates"), "update", () => show("updates"))}
          </div>
          {AUTH_GATE_ENABLED && <div className="account-separated"><button className="account-action" aria-label={t("account.row.logout")} disabled={identity?.kind !== "account" || busy} title={identity?.kind === "account" ? t("account.row.logout.title.in") : t("account.row.logout.title.out")} onClick={() => show("logout")}><HomeIcon name="logout" size={17} /><span>{t("account.row.logout")}</span></button></div>}
        </div>
      </>}
      {message && <p className="account-menu-status" role="status">{message}</p>}
    </div>, document.body)}
  </>;
}
