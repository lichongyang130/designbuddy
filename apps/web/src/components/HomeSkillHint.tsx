import type { RuntimeSkill } from "../../../../shared/skillRuntime";
import { HomeIcon } from "./HomeIcon";
import { skillGate, useRuntimeSkill } from "./useRuntimeSkill";

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
 * runtime catalogue: no permission is granted here, nothing is installed, and
 * the same check blocks the send button before a task is created.
 */
export function HomeSkillHint({ selected, attachmentCount, onUpload, onClear }: Props) {
  const skill = useRuntimeSkill(selected);
  if (!selected || !skill) return null;

  const gate = skillGate(skill, attachmentCount);
  const blocked = skill.status !== "ready";
  const permissions = skill.permissions ?? [];
  const needsFile = gate?.action?.kind === "upload";

  return (
    <div className={`home-skill-hint${blocked || gate ? " is-blocked" : ""}`} role="note">
      <div className="hsh-line">
        <span className="hsh-tag">{blocked ? "暂不可用" : needsFile ? "待上传文件" : "已装入输入框"}</span>
        <strong>{skill.name}</strong>
        {skill.accepts.length > 0 && <span className="hsh-meta">接受 {skill.accepts.join(" / ")}</span>}
        <button type="button" className="hsh-clear" onClick={onClear} aria-label="清除已选技能">×</button>
      </div>

      {blocked && <p className="hsh-note">{skill.description}</p>}

      {needsFile && (
        <p className="hsh-note">
          {gate?.blocked}
          <button type="button" className="hsh-action" onClick={onUpload}>
            <HomeIcon name="folder" size={12} /> 选择文件
          </button>
        </p>
      )}

      {!gate && requirements(skill) && (
        <p className="hsh-note is-quiet">还需要：{requirements(skill)}</p>
      )}

      {!blocked && permissions.length > 0 && (
        <p className="hsh-note is-quiet">
          执行时会用到：{permissions.map((permission) => permissionLabels[permission] ?? permission).join("、")}
        </p>
      )}
    </div>
  );
}

function requirements(skill: RuntimeSkill): string {
  return (skill.requires ?? []).map((item) => item.label).join("、");
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
