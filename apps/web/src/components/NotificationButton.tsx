import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HomeIcon } from "./HomeIcon";
import { clearReadNotifications, markNotificationRead, removeNotification, useNotifications } from "../../../../frontend/workspace/notifications";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
import { getProject } from "../../../../frontend/workspace/projectStore";
import { projectTaskPath } from "../../../../frontend/workspace/taskConversation";
import "./notifications.css";

export function NotificationButton({ label = "通知", className = "" }: { label?: string; className?: string }) {
  const { items, storageFailed } = useNotifications();
  const unread = items.filter((n) => !n.read).length;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notice, setNotice] = useState("");
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  function close(focus = false) { setOpen(false); if (focus) trigger.current?.focus({ preventScroll: true }); }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const anchor = trigger.current.getBoundingClientRect(), box = panel.current.getBoundingClientRect();
      const v = window.visualViewport, x = v?.offsetLeft || 0, y = v?.offsetTop || 0;
      const width = v?.width || window.innerWidth, height = v?.height || window.innerHeight;
      const above = anchor.top - box.height - 10;
      setPosition({ left: Math.max(x + 8, Math.min(anchor.left, x + width - box.width - 8)), top: Math.max(y + 8, Math.min(above >= y + 8 ? above : anchor.bottom + 10, y + height - box.height - 8)) });
    };
    const outside = (e: Event) => { if (e.target instanceof Node && !panel.current?.contains(e.target) && !trigger.current?.contains(e.target)) close(); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(true); } };
    place(); panel.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(place); if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    document.addEventListener("pointerdown", outside); document.addEventListener("focusin", outside); document.addEventListener("keydown", escape);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); window.visualViewport?.removeEventListener("resize", place); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const visible = items.filter((n) => filter === "all" || !n.read);
  return <>
    <button ref={trigger} className={`notification-trigger ${className}`} title={unread ? `通知 · ${unread} 条未读` : "通知"} aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { setNotice(""); setOpen((v) => !v); }}>
      <HomeIcon name="bell" size={className ? 19 : 16} />
      {unread > 0 && <span className="notification-unread-dot" aria-label={`${unread} 条未读通知`} />}
    </button>
    {open && createPortal(<div ref={panel} id={id} className="notification-panel" role="dialog" aria-label="通知中心" tabIndex={-1} style={position}>
      <header><div><h2>通知</h2><span>本机任务动态 · {unread} 条未读</span></div><button className="notification-close" aria-label="关闭通知" onClick={() => close(true)}>×</button></header>
      <div className="notification-toolbar"><div className="notification-filters" role="group" aria-label="通知筛选"><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部</button><button aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>未读{unread > 0 ? ` ${unread}` : ""}</button></div><button disabled={!unread} onClick={() => markNotificationRead()}>全部已读</button></div>
      {(notice || storageFailed) && <p className="notification-notice" role="status">{notice || "浏览器存储不可用，通知暂存于本页，刷新后可能丢失。"}</p>}
      <div className="notification-list">
        {visible.length ? <ul>{visible.map((n) => <li key={n.id} className={n.read ? "is-read" : "is-unread"}>
          <button className="notification-entry" onClick={() => {
            if (!getProject(n.projectId)) { setNotice("原任务已不存在，通知记录仍保留。可单独删除这条通知。"); return; }
            markNotificationRead(n.id); close(); navigateTo(projectTaskPath(n.projectId));
          }}><span className={`notification-kind is-${n.kind}`}><HomeIcon name={n.kind === "complete" ? "check" : n.kind === "error" ? "help" : "clock"} size={16} /></span><span className="notification-copy"><strong>{n.title}</strong><span>{n.description}</span><time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time></span>{!n.read && <span className="notification-item-dot" aria-label="未读" />}</button>
          <div className="notification-item-actions">{!n.read && <button onClick={() => markNotificationRead(n.id)}>标为已读</button>}<button aria-label={`删除通知：${n.title}`} onClick={() => removeNotification(n.id)}>删除</button></div>
        </li>)}</ul> : <div className="notification-empty" role="status"><HomeIcon name="bell" size={28} /><strong>{filter === "unread" ? "没有未读通知" : "暂时没有通知"}</strong><p>任务完成、回复失败或需要确认时，<br />会在这里留下记录。</p></div>}
      </div>
      <footer><span>仅此浏览器 · 非手机推送</span><button disabled={!items.some((n) => n.read)} onClick={clearReadNotifications}>清除已读</button></footer>
    </div>, document.body)}
  </>;
}
