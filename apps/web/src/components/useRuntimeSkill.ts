import { useEffect, useState } from "react";
import type { RuntimeSkill } from "../../../../shared/skillRuntime";

/**
 * The runtime catalogue is ~60 KB of skill declarations that the homepage does
 * not otherwise need. It is fetched once, on first use, and shared by every
 * component that asks for it.
 */
let cache: RuntimeSkill[] | null = null;
let pending: Promise<RuntimeSkill[]> | null = null;

export function loadRuntimeSkills(): Promise<RuntimeSkill[]> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = import("../../../../shared/skillRuntime")
      .then((module) => {
        cache = module.runtimeSkills;
        return cache;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

/** Resolve what the composer is holding: a skill id, or the display name a plugin chip filled in. */
export function matchRuntimeSkill(skills: RuntimeSkill[], selected: string): RuntimeSkill | undefined {
  const wanted = selected.trim();
  if (!wanted) return undefined;
  return (
    skills.find((skill) => skill.id === wanted) ??
    skills.find((skill) => skill.name === wanted) ??
    skills.find((skill) => skill.name.includes(wanted) || wanted.includes(skill.name))
  );
}

/** Every runtime skill, loaded once. Pass to children that rank or filter them. */
export function useCatalogSkills(enabled = true): RuntimeSkill[] | null {
  const [skills, setSkills] = useState<RuntimeSkill[] | null>(cache);
  useEffect(() => {
    if (!enabled || skills) return;
    let cancelled = false;
    void loadRuntimeSkills()
      .then((list) => { if (!cancelled) setSkills(list); })
      .catch(() => { /* stays null: callers render nothing rather than guess */ });
    return () => { cancelled = true; };
  }, [enabled, skills]);
  return skills;
}

/** The declaration behind the selected skill, or undefined while it loads / when it is catalog-only. */
export function useRuntimeSkill(selected: string): RuntimeSkill | undefined {
  const [skills, setSkills] = useState<RuntimeSkill[] | null>(cache);

  useEffect(() => {
    if (!selected || skills) return;
    let cancelled = false;
    void loadRuntimeSkills()
      .then((list) => { if (!cancelled) setSkills(list); })
      .catch(() => { /* stays undefined: no hint, no gate */ });
    return () => { cancelled = true; };
  }, [selected, skills]);

  return selected && skills ? matchRuntimeSkill(skills, selected) : undefined;
}

export type SkillSelection = {
  /** The declaration, when the name resolves to a runtime skill. */
  skill?: RuntimeSkill;
  /**
   * The catalogue is loaded, the person selected something, and nothing matches:
   * this is a catalogue entry (a specification) with no executor behind it.
   */
  unknown: boolean;
};

/** Resolve what the composer holds, and say when it cannot run at all. */
export function useSkillSelection(selected: string): SkillSelection {
  const skills = useCatalogSkills(Boolean(selected.trim()));
  if (!selected.trim() || !skills) return { unknown: false };
  const skill = matchRuntimeSkill(skills, selected);
  return { skill, unknown: !skill };
}

export type SkillGate = {
  /** Why the composer must not send yet, in the person's words. */
  blocked: string;
  /** What to do about it. */
  action?: { label: string; kind: "upload" | "clear" };
};

/**
 * Pre-send check for a selected skill.
 *
 * Only facts the skill declares are used: an unavailable skill is refused, and a
 * file-based skill cannot run without a file. Nothing here guesses about content
 * quality — the executor still validates the file itself.
 */
/**
 * The same gate, but for a selection that may not resolve to anything. A
 * catalogue entry has no executor, so sending it as "使用技能：…" would be a
 * claim the task page cannot honour.
 */
export function selectionGate(
  selection: SkillSelection,
  attachmentCount: number,
  options: { requireFile?: boolean } = {},
): SkillGate | null {
  if (selection.unknown) {
    return {
      blocked: "这个插件只是目录里的能力规格，没有可执行的执行器；请到插件页选择具体技能，或清除后按普通对话发送。",
      action: { label: "清除这个技能", kind: "clear" },
    };
  }
  return skillGate(selection.skill, attachmentCount, options);
}

export function skillGate(
  skill: RuntimeSkill | undefined,
  attachmentCount: number,
  options: { requireFile?: boolean } = {},
): SkillGate | null {
  if (!skill) return null;
  if (skill.status !== "ready") {
    return {
      blocked: `技能「${skill.name}」在当前服务端不可用：${skill.description}`,
      action: { label: "清除这个技能", kind: "clear" },
    };
  }
  // A skill workflow ("用实际文件执行技能") deliberately sends first and lets the
  // person pick the real material on the task page, so only the chat path insists
  // on an attachment here.
  if (options.requireFile === false) return null;
  const needsFile = skill.accepts.length > 0 && attachmentCount === 0;
  if (needsFile) {
    return {
      blocked: `技能「${skill.name}」需要先上传 ${skill.accepts.join(" / ")} 文件，才会真正执行。`,
      action: { label: "选择文件", kind: "upload" },
    };
  }
  return null;
}
