/**
 * Which skills each homepage mode recommends.
 *
 * Only runtime skills with a real executor are pickable: the 480 catalogue
 * entries are specifications and would produce a card that cannot run. The map
 * is checked by `apps/web/tests/plugin-picks.test.mjs` against the server's own
 * catalogue, so a renamed skill fails the test instead of silently vanishing.
 */
export type PickSkill = {
  id: string;
  name: string;
  status: "ready" | "unavailable";
  accepts: string[];
  outputs: string[];
  requires?: { label: string }[];
};

export type PickBundle = { skills: { id: string }[] };

export type HomeModeKey = "office" | "code" | "design";

export const MODE_SKILL_IDS: Record<HomeModeKey, string[]> = {
  office: ["document.format", "table.analyze", "data.report", "table.calculate"],
  design: ["infographic.compose", "social.carousel", "brand.system", "design.tokens"],
  code: ["web.audit", "code.inspect", "test.browser", "web.verify"],
};

export const MODE_REASON: Record<HomeModeKey, string> = {
  office: "把文档、表格直接变成可交付文件",
  design: "在本机渲染真实图片与规范",
  code: "对页面和源码做可复核的检查",
};

export type Pick = { skill: PickSkill; installed: boolean };

/**
 * Two picks at most, in declaration order, with skills from enabled bundles
 * first: those are the ones the person explicitly turned on.
 */
export function rankPicks(skills: PickSkill[], bundles: PickBundle[], mode: HomeModeKey, limit = 2): Pick[] {
  const installedIds = new Set<string>();
  for (const bundle of bundles) for (const skill of bundle.skills) installedIds.add(skill.id);
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  return MODE_SKILL_IDS[mode]
    .map((id) => byId.get(id))
    .filter((skill): skill is PickSkill => Boolean(skill) && skill!.status === "ready")
    .map((skill, order) => ({ skill, installed: installedIds.has(skill.id), order }))
    .sort((a, b) => Number(b.installed) - Number(a.installed) || a.order - b.order)
    .slice(0, limit)
    .map(({ skill, installed }) => ({ skill, installed }));
}
