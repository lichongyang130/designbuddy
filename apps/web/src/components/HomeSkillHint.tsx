import { useEffect, useMemo, useState } from "react";
import type { RuntimeSkill } from "../../../../shared/skillRuntime";
import { HomeIcon } from "./HomeIcon";

type Props = {
  /** The skill the composer is currently holding, as a skill id or a skill name. */
  selected: string;
  attachmentCount: number;
  onUpload: () => void;
  onClear: () => void;
};

/**
 * Shows, right under the composer, what the selected skill will actually accept
 * and what it still needs from the person. It is a read-only projection of the
 * runtime catalogue: no permission is granted here, nothing is installed.
 */
export function HomeSkillHint({ selected, attachmentCount, onUpload, onClear }: Props) {
  const [skills, setSkills] = useState<RuntimeSkill[]>([]);

  useEffect(() => {
    if (!selected || skills.length) return;
    let cancelled = false;
    void import("../../../../shared/skillRuntime")
      .then((mod) => { if (!cancelled) setSkills(mod.runtimeSkills); })
      .catch(() => { /* hint simply stays hidden */ });
    return () => { cancelled = true; };
  }, [selected, skills.length]);

  const skill = useMemo(() => {
    if (!selected) return undefined;
    return skills.find((item) => item.id === selected)
      ?? skills.find((item) => item.name === selected)
      ?? skills.find((item) => item.name.includes(selected) || selected.includes(item.name));
  }, [skills, selected]);

  if (!selected || !skill) return null;

  const needsFile = !skill.accepts.includes(".json") && attachmentCount === 0;
  const unavailable = skill.status !== "ready";
  const permissions = skill.permissions ?? [];

  return (
    <div className={`home-skill-hint${unavailable ? " is-blocked" : ""}`} role="note">
      <div className="hsh-line">
        <span className="hsh-tag">{unavailable ? "暂不可用" : "已装入输入框"}</span>
        <strong>{skill.name}</strong>
        {skill.accepts.length > 0 && (
          <span className="hsh-meta">接受 {skill.accepts.join(" / ")}</span>
        )}
        <button type="button" className="hsh-clear" onClick={onClear} aria-label="清除已选技能">×</button>
      </div>

      {unavailable && <p className="hsh-note">{skill.description}</p>}

      {!unavailable && needsFile && (
        <p className="hsh-note">
          这个技能需要你提供文件，上传后才会真正执行。
          <button type="button" className="hsh-action" onClick={onUpload}>
            <HomeIcon name="folder" size={12} /> 选择文件
          </button>
        </p>
      )}

      {!unavailable && skill.requires && skill.requires.length > 0 && (
        <p className="hsh-note is-quiet">
          还需要：{skill.requires.map((item) => item.label).join("、")}
        </p>
      )}

      {!unavailable && permissions.length > 0 && (
        <p className="hsh-note is-quiet">
          执行时会用到：{permissions.map((permission) => permissionLabels[permission] ?? permission).join("、")}
        </p>
      )}
    </div>
  );
}

/** Mirrors shared/skillRuntime.skillPermissionLabels without importing the catalogue eagerly. */
const permissionLabels: Record<string, string> = {
  "local.read": "读取你上传的文件",
  "local.write": "在工作区写出成果文件",
  network: "访问网络地址",
  subprocess: "启动本地子进程",
  "external.ai": "把内容发给第三方 AI 模型",
  "external.image": "把提示词发给第三方图像模型",
  "external.calendar": "写入第三方日历",
  "external.email": "写入第三方邮箱",
};
