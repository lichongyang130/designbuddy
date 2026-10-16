import { HomeIcon, type HomeIconName } from "../../apps/web/src/components/HomeIcon";
import { navigateTo, workspaceRoutes } from "./workspaceRoutes";

const tabs: { id: "experts" | "skills" | "connectors"; label: string; icon: HomeIconName; path: string }[] = [
  { id: "experts", label: "专家", icon: "experts", path: workspaceRoutes.experts },
  { id: "skills", label: "技能", icon: "tools", path: workspaceRoutes.skills },
  { id: "connectors", label: "连接器", icon: "link", path: workspaceRoutes.connectors },
];

export function MarketNavigation({ active, className = "market-nav" }: { active: "experts" | "skills" | "connectors"; className?: string }) {
  return <nav className={className} aria-label="专家技能连接器导航">{tabs.map((tab) => <button key={tab.id} className={active === tab.id ? "is-active" : ""} aria-current={active === tab.id ? "page" : undefined} onClick={() => navigateTo(tab.path)}><HomeIcon name={tab.icon} size={21} />{tab.label}</button>)}</nav>;
}
