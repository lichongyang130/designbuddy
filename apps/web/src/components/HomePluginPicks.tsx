import { useMemo } from "react";
import type { HomeMode } from "./homeScenes";
import { modeLabels } from "./homeScenes";
import { HomeIcon } from "./HomeIcon";
import { MODE_REASON, rankPicks } from "./pluginPicks";
import { useCatalogSkills } from "./useRuntimeSkill";
import { useHomePlugins } from "./useHomePlugins";

/**
 * 1–2 plugin picks for the current mode, under the prompt recommendations.
 *
 * A pick is always a real runtime skill: the catalogue entries (480 of them) are
 * specifications with no executor, so recommending one would be a promise this
 * app cannot keep. "已启用" marks the ones that also belong to an enabled bundle.
 */
type Props = {
  mode: HomeMode;
  onUseSkill: (skillName: string) => void;
  onNavigatePlugins: () => void;
};

export function HomePluginPicks({ mode, onUseSkill, onNavigatePlugins }: Props) {
  const skills = useCatalogSkills();
  const { bundles } = useHomePlugins();

  const picks = useMemo(
    () => (skills ? rankPicks(skills, bundles, mode) : []),
    [skills, bundles, mode],
  );

  if (picks.length === 0) return null;

  return (
    <section className="home-plugin-picks" aria-label={`${modeLabels[mode]}的插件推荐`}>
      <header className="hpp-head">
        <h2>
          插件推荐 <span>/ {modeLabels[mode]}</span>
        </h2>
        <button type="button" onClick={onNavigatePlugins}>全部插件 <span aria-hidden="true">→</span></button>
      </header>
      <p className="hpp-sub">{MODE_REASON[mode]}；点击只填入需求，不会立即执行。</p>
      <ul className="hpp-list">
        {picks.map(({ skill, installed }) => (
          <li key={skill.id}>
            <button type="button" className="hpp-card" onClick={() => onUseSkill(skill.name)} title={skill.id}>
              <span className="hpp-icon" aria-hidden="true"><HomeIcon name={mode === "code" ? "tools" : mode === "design" ? "palette" : "document"} size={14} /></span>
              <span className="hpp-body">
                <span className="hpp-title">
                  <strong>{skill.name}</strong>
                  <span className={`hpp-badge${installed ? " is-on" : ""}`}>{installed ? "已启用" : "技能"}</span>
                </span>
                <small>
                  {skill.accepts.join(" / ")}
                  {skill.outputs.length > 0 ? ` → ${skill.outputs.slice(0, 2).join("、")}` : ""}
                  {skill.requires && skill.requires.length > 0 ? ` · 需你提供：${skill.requires.map((item) => item.label).join("、")}` : ""}
                </small>
              </span>
              <span className="hpp-arrow" aria-hidden="true">↗</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
