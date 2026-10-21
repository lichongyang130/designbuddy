import { Suspense, lazy, type ReactNode } from "react";
import LoginPage from "../components/LoginPage";
import RegisterPage from "../components/RegisterPage";
import InspirationPage from "../inspiration/InspirationPage";
import type { AccountIdentity } from "../../../../frontend/workspace/api/account";
import { AUTH_GATE_ENABLED } from "../../../../frontend/workspace/authGate";

const PluginsPage = lazy(() => import("../../../../frontend/workspace/pages/PluginsPage"));
const ThemesPage = lazy(() => import("../../../../frontend/workspace/pages/ThemesPage"));
const SchedulesPage = lazy(() => import("../../../../frontend/workspace/pages/SchedulesPage"));
const ModelsPage = lazy(() => import("../../../../frontend/workspace/pages/ModelsPage"));
const ProfilePage = lazy(() => import("../../../../frontend/workspace/pages/ProfilePage"));
const WorkspacesPage = lazy(() => import("../../../../frontend/workspace/pages/WorkspacesPage"));
const AssetsPage = lazy(() => import("../../../../frontend/workspace/pages/AssetsPage"));
const CommunityPage = lazy(() => import("../../../../frontend/workspace/pages/CommunityPage"));
const WorkflowsPage = lazy(() => import("../../../../frontend/workspace/pages/WorkflowsPage"));
const AgentWorkbenchPage = lazy(() => import("../../../../frontend/workspace/pages/AgentWorkbenchPage"));
const AdminPage = lazy(() => import("../../../../frontend/workspace/pages/AdminPage"));
const DesignLibrary = lazy(() => import("../../../../frontend/workspace/pages/DesignLibrary"));
const StudioPage = lazy(() =>
  import("../../../../frontend/workspace").then((m) => ({ default: m.StudioPage })),
);
const ShareProjectPage = lazy(() =>
  import("../../../../frontend/workspace").then((m) => ({ default: m.ShareProjectPage })),
);
const WorkspaceHub = lazy(() =>
  import("../../../../frontend/workspace").then((m) => ({ default: m.WorkspaceHub })),
);
const TaskConversationPage = lazy(
  () => import("../../../../frontend/workspace/pages/TaskConversationPage"),
);
const ProjectEditorPage = lazy(() =>
  import("../../../../frontend/workspace").then((m) => ({ default: m.ProjectEditorPage })),
);
const ProjectsPage = lazy(() =>
  import("../../../../frontend/workspace").then((m) => ({ default: m.ProjectsPage })),
);
const PptPage = lazy(() => import("../../../../frontend/workspace/pages/PptPage"));
const PptOutlinePicker = lazy(() => import("../../../../frontend/workspace/pages/PptOutlinePicker"));
const PptSharePage = lazy(() => import("../../../../frontend/workspace/pages/PptSharePage"));

function RouteFallback({ label, text }: { label: string; text: string }) {
  return (
    <div className="auth-loading" role="status" aria-label={label}>
      <span className="auth-loading-spinner" aria-hidden="true" />
      {text}
    </div>
  );
}

function wrapLazy(node: ReactNode, label = "正在加载页面", text = "正在加载页面…") {
  return <Suspense fallback={<RouteFallback label={label} text={text} />}>{node}</Suspense>;
}

function isWorkspaceHubPath(path: string) {
  return path.startsWith("/experts") || path.startsWith("/skills") || path.startsWith("/connectors");
}

export interface WorkspaceRouteSwitchProps {
  currentPath: string;
  publicRoute: boolean;
  identity: AccountIdentity | null | undefined;
  identityFailed: boolean;
  onRetryIdentity: () => void;
}

/**
 * Pure non-home route dispatcher. Returns `null` when the homepage view should render.
 */
export function renderWorkspaceRoute({
  currentPath,
  publicRoute,
  identity,
  identityFailed,
  onRetryIdentity,
}: WorkspaceRouteSwitchProps): ReactNode | null {
  if (AUTH_GATE_ENABLED && (currentPath === "/login" || currentPath === "/auth")) return <LoginPage />;
  if (AUTH_GATE_ENABLED && currentPath === "/register") return <RegisterPage />;

  if (AUTH_GATE_ENABLED && !publicRoute) {
    if (identity === undefined && !identityFailed) {
      return <RouteFallback label="正在确认登录状态" text="正在确认登录状态…" />;
    }
    if (identityFailed || !identity) {
      return (
        <div className="auth-loading" role="alert">
          <p>无法连接后台服务，请确认服务已启动后重试。</p>
          <button onClick={onRetryIdentity}>重新连接</button>
        </div>
      );
    }
    if (identity.kind !== "account") {
      return <LoginPage next={currentPath + window.location.search} />;
    }
  }

  if (currentPath === "/plugins") {
    return wrapLazy(<PluginsPage />, "正在加载插件页", "正在加载插件目录…");
  }
  if (currentPath === "/themes") {
    return wrapLazy(<ThemesPage />, "正在加载主题库", "正在加载主题库…");
  }
  if (currentPath === "/schedules") return wrapLazy(<SchedulesPage />);
  if (currentPath === "/models") return wrapLazy(<ModelsPage />);
  if (currentPath === "/profile") return wrapLazy(<ProfilePage />);
  if (currentPath === "/workspaces") return wrapLazy(<WorkspacesPage />);
  if (currentPath === "/assets") return wrapLazy(<AssetsPage />);
  if (currentPath === "/community") return wrapLazy(<CommunityPage />);
  if (currentPath === "/workflows") return wrapLazy(<WorkflowsPage />);
  if (currentPath === "/agent") {
    return wrapLazy(<AgentWorkbenchPage />, "正在加载 Agent 工作台", "正在加载 Agent 工作台…");
  }
  if (currentPath === "/admin") return wrapLazy(<AdminPage />);
  if (currentPath === "/inspiration" || currentPath.startsWith("/inspiration/")) {
    return <InspirationPage pathname={currentPath} />;
  }
  if (currentPath.startsWith("/library")) {
    return wrapLazy(<DesignLibrary />, "正在加载素材库", "正在加载素材库…");
  }
  if (currentPath === "/studio" || currentPath.startsWith("/studio/")) {
    return wrapLazy(<StudioPage />);
  }
  if (currentPath === "/share") return wrapLazy(<ShareProjectPage />);
  const shareMatch = currentPath.match(/^\/share\/([^/]+)$/);
  if (shareMatch) return wrapLazy(<ShareProjectPage token={decodeURIComponent(shareMatch[1])} />);
  if (isWorkspaceHubPath(currentPath)) return wrapLazy(<WorkspaceHub />);

  const taskMatch = currentPath.match(/^\/tasks\/([^/]+)$/);
  if (taskMatch) {
    let id = taskMatch[1];
    try {
      id = decodeURIComponent(id);
    } catch {
      /* Show the not-found view. */
    }
    return wrapLazy(<TaskConversationPage key={id} projectId={id} />);
  }

  const editorMatch = currentPath.match(/^\/editor\/([^/]+)$/);
  if (editorMatch) {
    let projectId = editorMatch[1];
    try {
      projectId = decodeURIComponent(projectId);
    } catch {
      /* Keep the raw id for the not-found screen. */
    }
    return wrapLazy(<ProjectEditorPage projectId={projectId} />);
  }

  if (currentPath === "/projects") return wrapLazy(<ProjectsPage />);
  if (typeof window !== "undefined" && /ppt-share/.test(window.location.hash)) {
    return wrapLazy(<PptSharePage />);
  }
  if (currentPath === "/ppt" || currentPath === "/ppt/") return wrapLazy(<PptPage />);

  const pptOutlineMatch = currentPath.match(/^\/ppt\/outline\/([^/]+)$/);
  if (pptOutlineMatch) {
    let outlineId = pptOutlineMatch[1];
    try {
      outlineId = decodeURIComponent(outlineId);
    } catch {
      /* raw */
    }
    return wrapLazy(<PptOutlinePicker outlineId={outlineId} />);
  }

  const pptMatch = currentPath.match(/^\/ppt\/([^/]+)$/);
  if (pptMatch) {
    let pptId = pptMatch[1];
    try {
      pptId = decodeURIComponent(pptId);
    } catch {
      /* pass raw */
    }
    return wrapLazy(<PptPage pptId={pptId} />);
  }

  return null;
}
