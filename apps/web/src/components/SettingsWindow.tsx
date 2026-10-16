import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HomeIcon, type HomeIconName } from "./HomeIcon";
import { AIProviderSettings } from "../../../../frontend/workspace/AIProviderSettings";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
import {
  closeSettings,
  openSettings,
  refreshPreferences,
  removeCustomModel,
  saveCustomModel,
  setFontSize,
  setLinkMode,
  SETTINGS_KEY,
  usePreferences,
  useSettingsWindow,
  type CustomModel,
  type SettingsSection,
} from "../../../../frontend/workspace/settingsStore";
import "./settings-window.css";

type Section = {
  id: SettingsSection;
  name: string;
  icon: HomeIconName;
  keywords?: string;
};
const groups: { label: string; items: Section[] }[] = [
  {
    label: "设置",
    items: [
      {
        id: "general",
        name: "通用",
        icon: "settings",
        keywords:
          "常规 语言 链接打开方式 字体大小 权限 允许锁屏运行 运行时防止系统休眠 开机自动启动 网络代理 自动安装可信技能",
      },
      { id: "profile", name: "个人主页", icon: "invite" },
      { id: "plan", name: "套餐与积分", icon: "chart" },
      { id: "appearance", name: "外观", icon: "palette" },
      { id: "shortcuts", name: "快捷键", icon: "panel" },
    ],
  },
  {
    label: "功能",
    items: [
      { id: "personalization", name: "个性化", icon: "pencil" },
      { id: "memory", name: "记忆与进化", icon: "bulb" },
      { id: "agents", name: "智能体", icon: "assistant" },
      {
        id: "models",
        name: "模型",
        icon: "grid",
        keywords: "自定义模型 添加模型 AI 服务商 API",
      },
      { id: "assistant", name: "助理", icon: "experts" },
      { id: "devices", name: "设备连接", icon: "devices" },
    ],
  },
  {
    label: "数据与安全",
    items: [
      { id: "data", name: "数据管理", icon: "book" },
      { id: "apps", name: "应用管理", icon: "panel" },
      { id: "security", name: "安全中心", icon: "shield" },
    ],
  },
];

function DesktopSwitch({ label }: { label: string }) {
  return (
    <button
      className="settings-switch"
      type="button"
      role="switch"
      aria-label={label}
      aria-checked="false"
      disabled
      title="当前浏览器未接入桌面系统权限"
    >
      <span />
    </button>
  );
}
function GeneralSettings({ onError }: { onError(message: string): void }) {
  const fontSize = usePreferences((state) => state.fontSize);
  const linkMode = usePreferences((state) => state.linkMode);
  const change = (callback: () => void) => {
    try {
      callback();
      onError("");
    } catch {
      onError("浏览器存储不可用，设置未保存。请检查存储权限或空间。");
    }
  };
  return (
    <>
      <section aria-labelledby="settings-normal-title">
        <h2 className="settings-section-label" id="settings-normal-title">
          常规
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <label htmlFor="settings-language">语言</label>
            <select id="settings-language" value="zh-CN" onChange={() => {}}>
              <option value="zh-CN">简体中文</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-link-mode">链接打开方式</label>
              <p>设置 DesignBuddy 对话中链接的默认打开策略。</p>
            </div>
            <select
              id="settings-link-mode"
              value={linkMode}
              onChange={(event) =>
                change(() =>
                  setLinkMode(
                    event.target.value as "smart" | "new-tab" | "same-tab",
                  ),
                )
              }
            >
              <option value="smart">智能打开</option>
              <option value="new-tab">新标签页打开</option>
              <option value="same-tab">当前标签页打开</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-font-size">字体大小</label>
              <p className="settings-font-help">任务输入框与回复正文</p>
            </div>
            <div className="settings-font-control">
              <input
                id="settings-font-size"
                type="range"
                min="12"
                max="20"
                step="1"
                value={fontSize}
                onChange={(event) =>
                  change(() => setFontSize(Number(event.target.value)))
                }
                aria-valuetext={`${fontSize} 像素`}
              />
              <div>
                <span>小</span>
                <button onClick={() => change(() => setFontSize(15))}>
                  默认
                </button>
                <span>大</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section aria-labelledby="settings-permissions-title">
        <h2 className="settings-section-label" id="settings-permissions-title">
          权限
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <label htmlFor="settings-lock">允许锁屏运行</label>
              <p>锁屏后的后台任务运行需要桌面客户端支持。</p>
            </div>
            <select
              id="settings-lock"
              value="off"
              disabled
              title="浏览器模式不支持系统锁屏控制"
            >
              <option value="off">关闭</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <strong>运行时防止系统休眠</strong>
              <p>任务运行期间的系统唤醒控制尚未接入。</p>
            </div>
            <DesktopSwitch label="运行时防止系统休眠" />
          </div>
          <div className="settings-row">
            <div>
              <strong>开机自动启动</strong>
              <p>浏览器页面不能设置电脑开机启动项。</p>
            </div>
            <DesktopSwitch label="开机自动启动" />
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-proxy">网络代理</label>
              <p>当前沿用浏览器与系统的网络设置。</p>
            </div>
            <select
              id="settings-proxy"
              value="system"
              disabled
              title="网页不能修改系统代理"
            >
              <option value="system">系统设置</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <strong>自动安装可信技能</strong>
              <p>当前不会自动安装或执行外部程序。</p>
            </div>
            <DesktopSwitch label="自动安装可信技能" />
          </div>
        </div>
      </section>
    </>
  );
}

function ModelsSettings() {
  const models = usePreferences((state) => state.models);
  const [editing, setEditing] = useState<CustomModel | "new" | null>(null);
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  function edit(model: CustomModel | "new") {
    setEditing(model);
    setName(model === "new" ? "" : model.name);
    setModelId(model === "new" ? "" : model.modelId);
    setError("");
    setNotice("");
    requestAnimationFrame(() => input.current?.focus());
  }
  return (
    <>
      <section
        className="settings-card settings-model-heading"
        aria-label="自定义模型"
      >
        <div>
          <h2>自定义模型</h2>
          <p>模型配置保存在此浏览器中，使用已配置的 AI 服务调用。</p>
        </div>
        <button className="settings-button" onClick={() => edit("new")}>
          添加模型
        </button>
      </section>
      {editing && (
        <form
          className="settings-card settings-model-form"
          aria-label={editing === "new" ? "添加模型" : "编辑模型"}
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setNotice("");
            try {
              saveCustomModel({
                id: editing === "new" ? undefined : editing.id,
                name,
                modelId,
              });
              setEditing(null);
              setNotice("已保存。可在首页或对话的模型列表中选择。");
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "模型未保存，请检查浏览器存储。",
              );
            }
          }}
        >
          <h3>{editing === "new" ? "添加模型" : "编辑模型"}</h3>
          <label>
            模型名称
            <input
              ref={input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder="例如：我的文本模型"
              required
            />
          </label>
          <label>
            模型标识
            <input
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              maxLength={128}
              placeholder="填写服务商提供的模型 ID"
              required
              spellCheck={false}
            />
          </label>
          <p>
            这里只保存模型名称和标识，不会自动下载模型或验证服务可用性。API
            密钥仅保存在浏览器会话中。
          </p>
          <AIProviderSettings />
          {error && (
            <p className="settings-error" role="alert">
              {error}
            </p>
          )}
          <div className="settings-form-actions">
            <button
              type="button"
              className="settings-button"
              onClick={() => {
                setEditing(null);
                setError("");
              }}
            >
              取消
            </button>
            <button className="settings-button is-primary" type="submit">
              保存模型
            </button>
          </div>
        </form>
      )}
      {notice && (
        <p className="settings-notice" role="status">
          {notice}
        </p>
      )}
      {error && !editing && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      {models.length > 0 && (
        <section
          className="settings-card settings-model-list"
          aria-label="已添加模型"
        >
          {models.map((model) => (
            <article key={model.id}>
              <div>
                <strong>{model.name}</strong>
                <code>{model.modelId}</code>
              </div>
              <button
                className="settings-button"
                aria-label={`编辑${model.name}`}
                onClick={() => edit(model)}
              >
                编辑
              </button>
              <button
                className="settings-button"
                aria-label={`移除${model.name}`}
                onClick={() => {
                  if (
                    !window.confirm(
                      `移除“${model.name}”的本地配置？已有任务不会被删除。`,
                    )
                  )
                    return;
                  try {
                    removeCustomModel(model.id);
                    setNotice("已移除本地模型配置。");
                    setError("");
                    if (editing !== "new" && editing?.id === model.id)
                      setEditing(null);
                  } catch {
                    setError("存储不可用，模型未移除。");
                  }
                }}
              >
                移除
              </button>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

const descriptions: Partial<Record<SettingsSection, string>> = {
  profile:
    "此处为本地展示资料。服务器账号注册、登录和连接状态请使用下方按钮或左下角“工作区状态”；尚未接通头像、联系方式等云端资料编辑。",
  plan: "套餐、积分与支付服务尚未接入；不会产生订阅或扣费。",
  appearance: "当前使用灰白外观：首页左侧灰色、右侧白色。不包含系统主题切换。",
  personalization:
    "可以在任务中选择专家、技能和工作空间。跨设备个性化同步尚未接入。",
  memory: "任务对话默认只保存在当前浏览器，项目同步不包含跨对话长期记忆。",
  agents: "可在专家页面管理任务角色。此处不会自动运行后台智能体。",
  assistant: "可在插件市场浏览能力规格，加入清单不代表安装或授权。",
  devices: "同一服务器账号可跨设备恢复已上传的项目与社区作品；远程设备管理尚未接入。",
  data: "草稿、对话与模型配置默认保存在当前浏览器；项目和社区模板需显式上传服务器。退出账号不会删除本机草稿；清理站点数据前请保留备份。",
  apps: "外部应用需在连接器页面单独配置与授权。",
  security:
    "模型服务密钥仅保存在当前浏览器会话，不写入项目或公共模型配置。外部连接器不会自动获得授权。",
};
function OtherSettings({
  section,
  name,
}: {
  section: SettingsSection;
  name: string;
}) {
  const routes: Partial<
    Record<SettingsSection, { label: string; path: string }>
  > = {
    agents: { label: "管理专家", path: "/experts" },
    assistant: { label: "查看插件", path: "/plugins" },
    apps: { label: "管理连接器", path: "/connectors" },
  };
  const link = routes[section];
  return (
    <section className="settings-card settings-info">
      <h2>{name}</h2>
      {section === "shortcuts" ? (
        <dl>
          <div>
            <dt>发送任务</dt>
            <dd>Enter</dd>
          </div>
          <div>
            <dt>输入换行</dt>
            <dd>Shift + Enter</dd>
          </div>
          <div>
            <dt>打开设置</dt>
            <dd>Ctrl / ⌘ + ,</dd>
          </div>
          <div>
            <dt>关闭弹窗</dt>
            <dd>Esc</dd>
          </div>
        </dl>
      ) : (
        <p>{descriptions[section]}</p>
      )}
      {(section === "profile" || section === "devices") && (
        <button
          className="settings-button"
          onClick={() => {
            closeSettings();
            requestAnimationFrame(() =>
              window.dispatchEvent(new Event("designbuddy:open-server")),
            );
          }}
        >
          后台连接与账号
        </button>
      )}
      {link && (
        <button
          className="settings-button"
          onClick={() => {
            closeSettings();
            navigateTo(link.path);
          }}
        >
          {link.label}
        </button>
      )}
    </section>
  );
}

export function SettingsWindow() {
  const { open, section } = useSettingsWindow();
  const fontSize = usePreferences((state) => state.fontSize);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const active = groups
    .flatMap((group) => group.items)
    .find((item) => item.id === section)!;
  const normalized = query.trim().toLocaleLowerCase();
  const shown = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.name} ${item.keywords || ""}`
          .toLocaleLowerCase()
          .includes(normalized),
      ),
    }))
    .filter((group) => group.items.length);
  useLayoutEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    if (open) {
      setQuery("");
      setError("");
    }
  }, [open]);
  useEffect(() => {
    setError("");
    content.current?.scrollTo(0, 0);
  }, [section]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--db-user-font-size",
      `${fontSize}px`,
    );
  }, [fontSize]);
  useLayoutEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        if (!useSettingsWindow.getState().open) openSettings();
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === SETTINGS_KEY || event.key === null)
        refreshPreferences();
    };
    window.addEventListener("keydown", shortcut);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("keydown", shortcut);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="settings-window"
      aria-label="设置"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href], [tabindex='0']",
          ),
        ).filter((element) => element.offsetParent !== null);
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        closeSettings();
      }}
      onClick={(event) => {
        if (event.target !== dialog.current) return;
        const bounds = dialog.current.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          closeSettings();
      }}
    >
      {open && (
        <div className="settings-layout">
          <button
            className="settings-close"
            title="关闭设置"
            aria-label="关闭设置"
            onClick={closeSettings}
          >
            <span />
          </button>
          <aside className="settings-sidebar" aria-label="设置导航">
            <label className="settings-search">
              <HomeIcon name="search" size={15} />
              <input
                aria-label="搜索设置项"
                placeholder="搜索设置项"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button aria-label="清空设置搜索" onClick={() => setQuery("")}>
                  ×
                </button>
              )}
            </label>
            <nav>
              {shown.map((group) => (
                <section key={group.label}>
                  <h2>{group.label}</h2>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      aria-current={section === item.id ? "page" : undefined}
                      className={section === item.id ? "is-active" : ""}
                      onClick={() =>
                        useSettingsWindow.setState({ section: item.id })
                      }
                    >
                      <HomeIcon name={item.icon} size={16} />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </section>
              ))}
              {shown.length === 0 && (
                <p className="settings-search-empty">没有匹配的设置项</p>
              )}
            </nav>
          </aside>
          <main
            ref={content}
            className="settings-content"
            aria-label={`${active.name}设置`}
          >
            {error && (
              <p className="settings-error" role="alert">
                {error}
              </p>
            )}
            {section === "general" ? (
              <GeneralSettings onError={setError} />
            ) : section === "models" ? (
              <ModelsSettings />
            ) : (
              <OtherSettings section={section} name={active.name} />
            )}
          </main>
        </div>
      )}
    </dialog>
  );
}
