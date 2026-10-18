import catalog from "../../../design-systems/catalog.json";
import type { DesignProject } from "../models/project";

export type DesignSystem = (typeof catalog)[number];
export const designSystems = catalog as DesignSystem[];

/** Render a portable brand contract that can travel with a project or agent prompt. */
export function createDesignContract(system: DesignSystem): string {
  const { color, typography, spacing, radius, shadow } = system.tokens;
  return [
    `# ${system.name} Design System`,
    "",
    `> ${system.philosophy} · ${system.category}`,
    "",
    "## Brand colors",
    `- Primary: ${color.primary || system.primary}`,
    `- Background: ${color.background}`,
    `- Surface: ${color.surface}`,
    `- Text: ${color.text}`,
    `- Muted text: ${color.muted}`,
    `- Border: ${color.border}`,
    `- Success / warning / danger: ${color.success} / ${color.warning} / ${color.danger}`,
    "",
    "## Typography",
    `- Display: ${typography.display}`,
    `- Body: ${typography.body}`,
    `- Scale: ${typography.scale.join(", ")} px`,
    `- Line height: ${typography.lineHeight}`,
    "",
    "## Layout tokens",
    `- Spacing: ${spacing.join(", ")} px`,
    `- Corner radius: ${radius.join(", ")} px`,
    `- Shadows: ${shadow.map((value) => `\`${value}\``).join(", ")}`,
    "",
    "## Components and accessibility",
    `- Components: ${system.components.join(", ")}`,
    ...system.accessibility.map((rule) => `- ${rule}`),
    "",
    "## Implementation rules",
    "- Use these tokens consistently; do not introduce a competing palette.",
    "- Keep text contrast readable and preserve visible keyboard focus.",
    "- Use semantic HTML and label every form control.",
    "",
  ].join("\n");
}

/** Add design tokens to the project's stylesheet and retain the selected catalog id. */
export function applyDesignSystemTokens(project: DesignProject, system: DesignSystem): DesignProject {
  const cssFile = project.files.find((file) => file.path === "src/styles.css");
  if (!cssFile) throw new Error("这个项目没有 src/styles.css，无法应用主题。");
  const { color } = system.tokens;
  const designContract = createDesignContract(system);
  const theme = `/* DesignBuddy theme start */\n:root { --db-primary: ${color.primary || system.primary}; --db-accent: ${color.success}; --db-canvas: ${color.background}; --db-surface: ${color.surface}; --db-text: ${color.text}; --db-border: ${color.border}; --db-warning: ${color.warning}; --db-danger: ${color.danger}; }\nbody { background-color: var(--db-canvas); color: var(--db-text); }\n.top-nav, .nav, header { border-color: var(--db-border); }\n.card, article, .panel { background-color: var(--db-surface); }\nh1 span, .eyebrow { color: var(--db-accent) !important; }\n.primary-link, .nav-cta, .shop-cta, .hero-actions .primary, .saas-bottom a { background-color: var(--db-primary) !important; }\n/* DesignBuddy theme end */`;
  const content = cssFile.content.replace(/\/\* DesignBuddy theme start \*\/[\s\S]*?\/\* DesignBuddy theme end \*\//g, "").trimEnd() + `\n\n${theme}\n`;
  return {
    ...project,
    designSystemId: system.id,
    files: [
      ...project.files.filter((file) => file.path !== "DESIGN.md"),
      ...project.files.map((file) => file.path === cssFile.path ? { ...file, content } : file),
      { path: "DESIGN.md", content: designContract, language: "text" },
    ],
    updatedAt: new Date().toISOString(),
  };
}
