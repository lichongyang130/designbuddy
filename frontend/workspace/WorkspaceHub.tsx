import { Suspense, lazy, useEffect, useState } from "react";
import { normalizeAppPath, resolveWorkspaceRoute } from "./workspaceRoutes";
import ExpertsPage from "./pages/ExpertsPage";
import ConnectorsPage from "./pages/ConnectorsPage";

// The skill catalogue declares every executor and its permissions (~60 KB), so it
// is only fetched when a workspace route actually asks for it.
const SkillsPage = lazy(() => import("./pages/SkillsPage"));

export default function WorkspaceHub() {
  const [pathname, setPathname] = useState(normalizeAppPath(window.location.pathname));

  useEffect(() => {
    const updatePath = () => setPathname(normalizeAppPath(window.location.pathname));
    window.addEventListener("popstate", updatePath);
    return () => window.removeEventListener("popstate", updatePath);
  }, []);

  const route = resolveWorkspaceRoute(pathname);
  if (route.section === "skills")
    return (
      <Suspense fallback={<div className="auth-loading" role="status" aria-label="正在加载技能目录">正在加载技能目录…</div>}>
        <SkillsPage pathname={pathname} />
      </Suspense>
    );
  if (route.section === "connectors") return <ConnectorsPage pathname={pathname} />;
  return <ExpertsPage pathname={pathname} />;
}
