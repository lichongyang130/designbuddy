/**
 * Where a blocked skill's requirement is actually fixed.
 *
 * The server tells us the *kind* of thing a skill needs (`credential`,
 * `environment`, `material`, `decision`, `account`); this module maps that to one
 * concrete next step so the button label and the action can never drift apart.
 */
export type RequirementActionKind = "settings-models" | "settings-apps" | "composer" | "none";

export type RequirementAction = {
  kind: RequirementActionKind;
  label: string;
  /** Shown next to the button, so nobody expects the UI to fix a server env var. */
  hint: string;
};

const ACTIONS: Record<string, RequirementAction> = {
  credential: {
    kind: "settings-models",
    label: "打开模型与密钥",
    hint: "客户端密钥在这里填写；标为服务端的环境变量只能由部署者配置。",
  },
  account: {
    kind: "settings-apps",
    label: "打开连接器设置",
    hint: "需要先授权对应的第三方账号，技能才会被允许外发。",
  },
  environment: {
    kind: "none",
    label: "需要服务端环境",
    hint: "这类依赖装在选择的服务端上，界面无法代你安装；请把下面的说明交给部署者。",
  },
  material: {
    kind: "composer",
    label: "去输入框补充",
    hint: "这类材料由你在任务里提供，平台不会替你生成。",
  },
  decision: {
    kind: "composer",
    label: "去输入框确认",
    hint: "这是一项需要你本人确认的决定，执行前会再问一次。",
  },
};

export function requirementAction(kind: string): RequirementAction {
  return ACTIONS[kind] ?? {
    kind: "none",
    label: "查看说明",
    hint: "服务端没有给出可自动化的处理方式，请按下面的说明人工处理。",
  };
}
