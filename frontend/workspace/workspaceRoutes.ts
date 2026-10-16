const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, "");

export const workspaceRoutes = {
  home: "/",
  plugins: "/plugins",
  inspiration: "/inspiration",
  projects: "/projects",
  experts: "/experts",
  myExperts: "/experts/mine",
  createExpert: "/experts/create",
  expertDetail: (id: string) => `/experts/${encodeURIComponent(id)}`,
  skills: "/skills",
  createSkill: "/skills/create",
  installedSkills: "/skills/installed",
  skillDetail: (id: string) => `/skills/${encodeURIComponent(id)}`,
  connectors: "/connectors",
  connectorOAuth: "/connectors/oauth",
  createConnector: "/connectors/create",
  connectorDetail: (id: string) => `/connectors/${encodeURIComponent(id)}`,
} as const;

export type WorkspaceRouteKey = keyof typeof workspaceRoutes;

/** Strip the Vite deploy base so route matching also works on repository Pages URLs. */
export function normalizeAppPath(pathname: string): string {
  let path = pathname;
  if (BASE_PATH && (path === BASE_PATH || path.startsWith(BASE_PATH + "/"))) {
    path = path.slice(BASE_PATH.length) || "/";
  }
  if (!path.startsWith("/")) path = "/" + path;
  return path.replace(/\/+$/, "") || "/";
}

export function navigateTo(path: string): void {
  const normalized = normalizeAppPath(path);
  const target = BASE_PATH ? BASE_PATH + normalized : normalized;
  if (normalizeAppPath(window.location.pathname) === normalized) return;
  window.history.pushState({}, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function resolveWorkspaceRoute(pathname: string): { section: "home" | "experts" | "skills" | "connectors"; page: string; id?: string } {
  const path = normalizeAppPath(pathname);
  if (path === "/experts/create") return { section: "experts", page: "create" };
  if (path === "/experts/mine") return { section: "experts", page: "mine" };
  if (path === "/experts") return { section: "experts", page: "marketplace" };
  const expert = path.match(/^\/experts\/([^/]+)$/);
  if (expert) return { section: "experts", page: "detail", id: decodeURIComponent(expert[1]) };
  if (path === "/skills/create") return { section: "skills", page: "create" };
  if (path === "/skills/installed") return { section: "skills", page: "installed" };
  if (path === "/skills") return { section: "skills", page: "marketplace" };
  const skill = path.match(/^\/skills\/([^/]+)$/);
  if (skill) return { section: "skills", page: "detail", id: decodeURIComponent(skill[1]) };
  if (path === "/connectors/create") return { section: "connectors", page: "create" };
  if (path === "/connectors/oauth") return { section: "connectors", page: "oauth" };
  if (path === "/connectors") return { section: "connectors", page: "marketplace" };
  const connector = path.match(/^\/connectors\/([^/]+)$/);
  if (connector) return { section: "connectors", page: "detail", id: decodeURIComponent(connector[1]) };
  return { section: "home", page: "home" };
}
