import { useEffect, useState } from "react";
import { normalizeAppPath, resolveWorkspaceRoute } from "./workspaceRoutes";
import ExpertsPage from "./pages/ExpertsPage";
import SkillsPage from "./pages/SkillsPage";
import ConnectorsPage from "./pages/ConnectorsPage";

export default function WorkspaceHub() {
  const [pathname, setPathname] = useState(normalizeAppPath(window.location.pathname));

  useEffect(() => {
    const updatePath = () => setPathname(normalizeAppPath(window.location.pathname));
    window.addEventListener("popstate", updatePath);
    return () => window.removeEventListener("popstate", updatePath);
  }, []);

  const route = resolveWorkspaceRoute(pathname);
  if (route.section === "skills") return <SkillsPage pathname={pathname} />;
  if (route.section === "connectors") return <ConnectorsPage pathname={pathname} />;
  return <ExpertsPage pathname={pathname} />;
}
