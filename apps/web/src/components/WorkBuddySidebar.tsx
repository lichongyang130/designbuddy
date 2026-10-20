import { NotificationButton } from "./NotificationButton";
import { useState, useEffect } from "react";
import ServerStatusPanel from "./ServerStatusPanel";
import { HomeIcon } from "./HomeIcon";
import { SidebarMoreMenu } from "./SidebarMoreMenu";
import "./sidebar-navigation.css";
import { AccountMenu } from "./AccountMenu";
import { usePreferences } from "../../../../frontend/workspace/settingsStore";
import { translate } from "../../../../frontend/workspace/i18n";

type Props = {
  active:
    | "home"
    | "experts"
    | "skills"
    | "connectors"
    | "task"
    | "plugins"
    | "themes"
    | "schedules"
    | "workflows"
    | "models"
    | "profile"
    | "templates";
  projectCount: number;
  /** How many workspaces the account belongs to. */
  workspaceCount?: number;
  assetCount?: number;
  go(path: string): void;
  setNotice(message: string): void;
};

export function WorkBuddySidebar({
  active,
  projectCount,
  workspaceCount = 0,
  assetCount = 0,
  go,
  setNotice,
}: Props) {
  const [serverOpen, setServerOpen] = useState(false);
  const locale = usePreferences((state) => state.locale);
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  useEffect(() => {
    const open = () => setServerOpen(true);
    window.addEventListener("designbuddy:open-server", open);
    return () => window.removeEventListener("designbuddy:open-server", open);
  }, []);
  return (
    <aside className="app-sidebar">
      {serverOpen && <ServerStatusPanel onClose={() => setServerOpen(false)} />}
      <div className="sidebar-windowbar">
        <div className="window-dots" aria-label={t("sidebar.window")}>
          <span className="window-dot window-dot--red" />
          <span className="window-dot window-dot--yellow" />
          <span className="window-dot window-dot--green" />
        </div>
        <div className="sidebar-utilities">
          <button
            title={t("sidebar.tasks")}
            aria-label={t("sidebar.tasks")}
            onClick={() => go("/projects")}
          >
            <HomeIcon name="panel" />
          </button>
          <button
            title={t("sidebar.search")}
            aria-label={t("sidebar.search")}
            onClick={() => go("/projects")}
          >
            <HomeIcon name="search" />
          </button>
          <button
            title={t("sidebar.filter")}
            aria-label={t("sidebar.filter")}
            onClick={() => go("/projects")}
          >
            <HomeIcon name="filter" />
          </button>
        </div>
      </div>

      <div className="brand-row">
        <button
          className="brand-lockup"
          onClick={() => go("/")}
          aria-label={t("sidebar.brandBack")}
        >
          <strong>DesignBuddy</strong>
          <span>5.7.7</span>
        </button>
      </div>

      <button
        className={`sidebar-nav-item is-prominent ${active === "home" ? "is-active" : ""}`}
        aria-current={active === "home" ? "page" : undefined}
        onClick={() => go("/")}
      >
        <HomeIcon name="home" />
        <span className="sidebar-nav-label">{t("sidebar.home")}</span>
      </button>

      <nav className="sidebar-navigation" aria-label={t("sidebar.nav")}>
        <button
          className={`sidebar-nav-item ${active === "plugins" ? "is-active" : ""}`}
          aria-current={active === "plugins" ? "page" : undefined}
          onClick={() => go("/plugins")}
        >
          <HomeIcon name="tools" />
          <span className="sidebar-nav-label">{t("sidebar.plugins")}</span>
        </button>
        <button
          className={`sidebar-nav-item ${active === "themes" ? "is-active" : ""}`}
          aria-current={active === "themes" ? "page" : undefined}
          onClick={() => go("/themes")}
        >
          <HomeIcon name="palette" />
          <span className="sidebar-nav-label">{t("sidebar.themes")}</span>
        </button>
        <button
          className={`sidebar-nav-item ${active === "templates" ? "is-active" : ""}`}
          aria-current={active === "templates" ? "page" : undefined}
          onClick={() => go("/inspiration")}
        >
          <HomeIcon name="grid" />
          <span className="sidebar-nav-label">{t("sidebar.templates")}</span>
        </button>
        <button
          className="sidebar-nav-item"
          aria-current={active === "schedules" ? "page" : undefined}
          onClick={() => go("/schedules")}
        >
          <HomeIcon name="clock" />
          <span className="sidebar-nav-label">{t("sidebar.schedules")}</span>
        </button>
        <button
          className={`sidebar-nav-item ${active === "workflows" ? "is-active" : ""}`}
          aria-current={active === "workflows" ? "page" : undefined}
          onClick={() => go("/workflows")}
        >
          <HomeIcon name="step" />
          <span className="sidebar-nav-label">{t("sidebar.workflows")}</span>
        </button>
        <SidebarMoreMenu active={active} go={go} />
      </nav>

      <div className="sidebar-lists">
        <button onClick={() => go("/projects")}>{t("sidebar.projects", { n: projectCount })}</button>
        <button onClick={() => go("/workspaces")}>
          {t("sidebar.spaces", { n: workspaceCount })}
        </button>
      </div>

      <div className="sidebar-bottom">
        <AccountMenu />
        <NotificationButton />
        <button
          title={t("sidebar.status")}
          aria-label={t("sidebar.status")}
          onClick={() => setServerOpen(true)}
        >
          <HomeIcon name="devices" />
        </button>
      </div>
    </aside>
  );
}
