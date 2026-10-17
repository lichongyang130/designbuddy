import { apiJSON, resetAPISession } from "../api/client";
import { useId, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { openSettings, type SettingsSection } from "../../../../frontend/workspace/settingsStore";
import { HomeIcon, type HomeIconName } from "./HomeIcon";
import avatarImage from "../assets/home-avatar.png";
import "./account-menu.css";

type Identity = { username: string | null; displayName?: string; kind: "account" | "guest" };
type Detail = "fuel" | "invite" | "growth" | "feedback" | "updates" | "logout";
const details: Record<Detail, { title: string; text: string }> = {
  fuel: { title: "Buddy加油站", text: "积分服务尚未接入，目前无法领取、充值或消耗积分。菜单不会显示虚构余额，也不会产生扣费。" },
  invite: { title: "去邀约", text: "邀请与奖励服务尚未开放，暂时没有可生成的邀请链接，也不会承诺或发放邀请积分。" },
  growth: { title: "成长计划", text: "成长任务、签到和抽奖服务尚未接入。当前没有可领取的奖励，也不会将浏览或点击伪装成已完成的成长任务。" },
  feedback: { title: "意见反馈", text: "可以先记录问题、复现步骤或改进建议，再复制或下载给维护者。反馈暂存于本浏览器，尚未接入在线提交服务。请勿填写密码、密钥或其他敏感信息。" },
  updates: { title: "检查更新", text: "更新服务尚未接入，暂时无法检查或安装更新。这里不会显示未经核实的“已是最新版本”，也不会自动下载程序或刷新你的工作区。" },
  logout: { title: "退出登录", text: "确认退出当前服务器账号？服务器会话将失效，但当前设备的本地项目、对话、通知及草稿仍会保留。公共设备上的本机数据需要你另行管理。" },
};
const feedbackKey = "designbuddy.feedback-draft.v1";
function readFeedback() {
  try { return (localStorage.getItem(feedbackKey) || "").slice(0, 4000); } catch { return ""; }
}
function maskName(name: string) { return /^\d{11}$/.test(name) ? `${name.slice(0, 3)}****${name.slice(-4)}` : name; }

/** Reference account menu; unavailable services are explicit, not simulated. */
export function AccountMenu() {
  const id = useId();
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
      if (result.ok !== true) throw Error("服务器未确认退出，请重试。");
      resetAPISession();
      window.location.assign("/login");
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "退出失败，请稍后重试。"); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  }
  function row(label: string, icon: HomeIconName, action: () => void, extra?: string, promo = false, arrow = false) {
    return <button className={`account-action${promo ? " account-action-promo" : ""}`} aria-label={label} onClick={action}><HomeIcon name={icon} size={17} /><span>{label}</span>{extra && <small>{label === "外观" && <i aria-hidden="true" />}{extra}</small>}{arrow && <HomeIcon name="chevron" size={12} />}</button>;
  }
  return <>
    <button ref={trigger} className="profile-trigger" title="账号菜单" aria-label={`账号菜单：${displayName}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { if (open) close(); else { setDetail(null); setMessage(""); setOpen(true); } }}>
      <img className="profile-avatar" src={avatarImage} alt="" width="33" height="33" /><strong>{displayName}</strong>
    </button>
    {open && createPortal(<div ref={panel} id={id} role="dialog" aria-label="账号菜单" tabIndex={-1} className="account-popover account-reference-menu" style={position} onKeyDown={keyboard}>
      {detail ? <section className="account-detail">
        <header><button aria-label="返回账号菜单" onClick={() => { setDetail(null); setMessage(""); }}><HomeIcon name="chevron" /></button><h2>{details[detail].title}</h2><button aria-label="关闭账号菜单" onClick={() => close(true)}>×</button></header>
        <p>{details[detail].text}</p>
        {detail === "feedback" && <>
          <label className="account-feedback-label">反馈内容<textarea aria-label="反馈内容" value={feedback} maxLength={4000} rows={6} placeholder="遇到了什么问题？可以补充操作步骤和预期结果。" onChange={event => {
            const text = event.target.value; setFeedback(text);
            try { localStorage.setItem(feedbackKey, text); setMessage("草稿已保存在本浏览器，未发送。"); }
            catch { setMessage("本机存储不可用，请复制或下载草稿，刷新后可能丢失。"); }
          }} /></label>
          <div className="account-detail-actions"><button disabled={!feedback.trim()} onClick={async () => {
            try { await navigator.clipboard.writeText(feedback); if (mounted.current) setMessage("已复制反馈，未发送。"); }
            catch { if (mounted.current) setMessage("无法访问剪贴板，请选中文字手动复制或下载。"); }
          }}>复制反馈</button><button disabled={!feedback.trim()} onClick={() => {
            const url = URL.createObjectURL(new Blob([`DesignBuddy 意见反馈（未发送）\n\n${feedback}`], { type: "text/plain;charset=utf-8" }));
            const link = document.createElement("a"); link.href = url; link.download = "DesignBuddy-反馈草稿.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("反馈已生成本地下载文件，未发送。");
          }}>下载草稿</button></div>
        </>}
        {detail === "logout" && <div className="account-detail-actions"><button onClick={() => { setDetail(null); setMessage(""); }}>取消</button><button className="is-primary" disabled={busy || identity?.kind !== "account"} onClick={() => void logout()}>{busy ? "正在退出…" : "确认退出"}</button></div>}
        {detail === "fuel" && <div className="account-detail-actions"><button onClick={() => settings("plan")}>查看套餐说明</button></div>}
      </section> : <>
        <div className="account-identity"><img src={avatarImage} alt="" width="40" height="40" /><div><strong title={maskName(displayName)}>{maskName(displayName)}</strong><small>{identityError ? "账号状态不可用" : !identity ? "正在读取账号…" : identity.kind === "account" ? "已登录服务器账号" : "访客模式 · 本地展示"}</small></div></div>
        <section className="account-plan" aria-label="套餐与积分"><div><span>套餐</span><strong>未接入</strong><button className="account-upgrade" title="查看套餐说明，尚不支持付费升级" onClick={() => settings("plan")}>升级套餐</button></div><div><span>积分余额</span><strong aria-label="积分余额未接入">—</strong><button className="account-purchase" disabled title="积分购买服务尚未接入">购买积分</button></div></section>
        <div className="account-actions">
          {row("Buddy加油站", "fuel", () => show("fuel"), undefined, true, true)}
          {row("去邀约", "invite", () => show("invite"), "暂未开放", true, true)}
          {row("成长计划", "growth", () => show("growth"), "暂未开放", true, true)}
          <div className="account-separated">
            {row("设置", "settings", () => settings("general"), "⌘ ,")}
            {row("外观", "palette", () => settings("appearance"), "灰白外观", false, true)}
            {row("记忆与进化", "bulb", () => settings("memory"))}
            {row("意见反馈", "help", () => show("feedback"))}
            {row("检查更新", "update", () => show("updates"))}
          </div>
          <div className="account-separated"><button className="account-action" aria-label="退出登录" disabled={identity?.kind !== "account" || busy} title={identity?.kind === "account" ? "退出服务器账号，本机数据仍保留" : "当前未登录服务器账号"} onClick={() => show("logout")}><HomeIcon name="logout" size={17} /><span>退出登录</span></button></div>
        </div>
      </>}
      {message && <p className="account-menu-status" role="status">{message}</p>}
    </div>, document.body)}
  </>;
}
