import { NotificationButton } from "./NotificationButton";
import { useState, useEffect } from "react";
import ServerStatusPanel from "./ServerStatusPanel";
import { HomeIcon } from "./HomeIcon";
import { SidebarMoreMenu } from "./SidebarMoreMenu";
import "./sidebar-navigation.css";
import { AccountMenu } from "./AccountMenu";

type Props = {
  active:
    | "home"
    | "experts"
    | "skills"
    | "connectors"
    | "task"
    | "plugins"
    | "schedules"
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
  useEffect(() => {
    const open = () => setServerOpen(true);
    window.addEventListener("designbuddy:open-server", open);
    return () => window.removeEventListener("designbuddy:open-server", open);
  }, []);
  return (
    <aside className="app-sidebar">
      {serverOpen && <ServerStatusPanel onClose={() => setServerOpen(false)} />}
      <div className="sidebar-windowbar">
        <div className="window-dots" aria-label="窗口控制">
          <span className="window-dot window-dot--red" />
          <span className="window-dot window-dot--yellow" />
          <span className="window-dot window-dot--green" />
        </div>
        <div className="sidebar-utilities">
          <button
            title="打开任务列表"
            aria-label="打开任务列表"
            onClick={() => go("/projects")}
          >
            <HomeIcon name="panel" />
          </button>
          <button
            title="搜索项目"
            aria-label="搜索项目"
            onClick={() => go("/projects")}
          >
            <HomeIcon name="search" />
          </button>
          <button
            title="筛选项目"
            aria-label="筛选项目"
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
          aria-label="返回 DesignBuddy 首页"
        >
          <strong>DesignBuddy</strong>
          <span>5.7.7</span>
        </button>
        <button
          className="discover-button"
          onClick={() => {
            setNotice(
              "从快捷场景选择文档、金融、数据或个人工作台任务，快速开始。",
            );
          }}
        >
          <HomeIcon name="assistant" size={14} /> 发现应用{" "}
          <HomeIcon name="chevron" size={10} />
        </button>
      </div>

      <button
        className={`sidebar-nav-item is-prominent ${active === "home" ? "is-active" : ""}`}
        aria-current={active === "home" ? "page" : undefined}
        onClick={() => go("/")}
      >
        <HomeIcon name="home" />
        <span className="sidebar-nav-label">首页</span>
      </button>

      <nav className="sidebar-navigation" aria-label="主导航">
        <button
          className={`sidebar-nav-item ${active === "plugins" ? "is-active" : ""}`}
          aria-current={active === "plugins" ? "page" : undefined}
          onClick={() => go("/plugins")}
        >
          <HomeIcon name="tools" />
          <span className="sidebar-nav-label">插件</span>
        </button>
        <button
          className={`sidebar-nav-item ${active === "templates" ? "is-active" : ""}`}
          aria-current={active === "templates" ? "page" : undefined}
          onClick={() => go("/inspiration")}
        >
          <HomeIcon name="grid" />
          <span className="sidebar-nav-label">模版</span>
        </button>
        <button
          className="sidebar-nav-item"
          aria-current={active === "schedules" ? "page" : undefined}
          onClick={() => go("/schedules")}
        >
          <HomeIcon name="clock" />
          <span className="sidebar-nav-label">定时任务</span>
        </button>
        <button
          className={`sidebar-nav-item ${active === "models" ? "is-active" : ""}`}
          aria-current={active === "models" ? "page" : undefined}
          onClick={() => go("/models")}
        >
          <HomeIcon name="chart" />
          <span className="sidebar-nav-label">模型与用量</span>
        </button>
        <button
          className={`sidebar-nav-item ${active === "profile" ? "is-active" : ""}`}
          aria-current={active === "profile" ? "page" : undefined}
          onClick={() => go("/profile")}
        >
          <HomeIcon name="shield" />
          <span className="sidebar-nav-label">账号与数据</span>
        </button>
        <SidebarMoreMenu active={active} go={go} />
      </nav>

      <div className="sidebar-lists">
        <button onClick={() => go("/projects")}>任务（{projectCount}）</button>
        <button onClick={() => go("/workspaces")}>
          空间（{workspaceCount}）
        </button>
        <button onClick={() => go("/assets")}>
          素材（{assetCount}）
        </button>
        <button onClick={() => go("/workflows")}>工作流</button>
        <button onClick={() => go("/community")}>社区模板</button>
      </div>

      <div className="sidebar-bottom">
        <AccountMenu />
        <NotificationButton />
        <button
          title="工作区状态"
          aria-label="工作区状态"
          onClick={() => setServerOpen(true)}
        >
          <HomeIcon name="devices" />
        </button>
      </div>
    </aside>
  );
}
