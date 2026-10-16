import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { HomeIcon, type HomeIconName } from "./HomeIcon";

const destinations: { id: string; label: string; icon: HomeIconName }[] = [
  { id: "experts", label: "专家", icon: "experts" },
  { id: "skills", label: "技能", icon: "bolt" },
  { id: "connectors", label: "连接器", icon: "link" },
];

export function SidebarMoreMenu({ active, go }: { active: string; go(path: string): void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusOnOpen = useRef(false);
  const selected = destinations.some(item => item.id === active);

  function cancelLeave() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }
  function close(restoreFocus = false) {
    cancelLeave();
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function scheduleClose() {
    cancelLeave();
    leaveTimer.current = setTimeout(() => setOpen(false), 180);
  }
  function show(keyboard = false) {
    cancelLeave();
    focusOnOpen.current = keyboard;
    setOpen(true);
    if (open && keyboard) menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }
  useLayoutEffect(() => () => cancelLeave(), []);
  useLayoutEffect(() => { close(); }, [active]);
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!trigger.current || !menu.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const sidebar = trigger.current.closest("aside")!.getBoundingClientRect();
      const box = menu.current.getBoundingClientRect();
      const onRight = sidebar.right + 8 + box.width <= window.innerWidth - 8;
      setPosition({
        left: onRight ? sidebar.right + 8 : Math.max(8, Math.min(anchor.left, window.innerWidth - box.width - 8)),
        top: Math.max(8, Math.min(onRight ? anchor.top : anchor.bottom + 6, window.innerHeight - box.height - 8)),
      });
    }
    function outside(event: Event) {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) close();
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
    }
    place();
    if (focusOnOpen.current) menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function onMenuKey(event: KeyboardEvent) {
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") || []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowLeft") { event.preventDefault(); close(true); }
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }
  return <>
    <button ref={trigger} className={`sidebar-nav-item sidebar-more-trigger ${selected ? "is-active" : ""}`} aria-current={selected ? "true" : undefined} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onPointerEnter={event => { if (event.pointerType === "mouse") show(); }} onPointerLeave={event => { if (event.pointerType === "mouse") scheduleClose(); }}
      onClick={event => show(event.detail === 0)} onKeyDown={event => { if (["ArrowRight", "ArrowDown"].includes(event.key)) { event.preventDefault(); show(true); } }}>
      <HomeIcon name="more" /><span className="sidebar-nav-label">更多</span><HomeIcon name="chevron" size={12} />
    </button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label="更多栏目" className="sidebar-more-menu" style={position} onPointerEnter={cancelLeave} onPointerLeave={event => { if (event.pointerType === "mouse") scheduleClose(); }} onKeyDown={onMenuKey}>
      {destinations.map(item => <button key={item.id} role="menuitem" aria-current={active === item.id ? "page" : undefined} onClick={() => { close(); go(`/${item.id}`); }}><HomeIcon name={item.icon} /><span>{item.label}</span></button>)}
    </div>, document.body)}
  </>;
}
