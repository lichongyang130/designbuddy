import type { RefObject } from "react";
import { PromptInput } from "../../../../../frontend/workspace/PromptInput";
import { isPptPrompt } from "../../../../../frontend/workspace/pptStore";
import { openSettings, type useModelOptions } from "../../../../../frontend/workspace/settingsStore";
type ModelOption = ReturnType<typeof useModelOptions>[number];
import { projectTaskPath } from "../../../../../frontend/workspace/taskConversation";
import { uploadAsset } from "../../../../../frontend/workspace/api/assets";
import { HomeAttachMenu } from "../../components/HomeAttachMenu";
import { HomeIcon } from "../../components/HomeIcon";
import { HomeModelMenu, ModelGlyph } from "../../components/HomeModelMenu";
import { HomeSkillHint } from "../../components/HomeSkillHint";
import { HomeRecent, HomeSuggestionBar, type RecentItem } from "../../components/HomeSuggestionBar";
import { HomeWorkspacePicker, type SpaceOption } from "../../components/HomeWorkspacePicker";
import type { HomeScene } from "../../components/homeScenes";
import { ExpertMatchPanel } from "../../components/ExpertMatchPanel";
import type { useExpertMatch } from "../../components/useExpertMatch";

export type WorkMode = "office" | "code" | "design";
export type TaskAttachment = { name: string; text?: string; assetId?: string };

const textAttachmentExtensions = /\.(txt|md|markdown|json|html|htm|css|js|csv|xml|yaml|yml)$/i;

export interface HomeComposerSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  composerRef: RefObject<HTMLElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  modelMenuRef: RefObject<HTMLDivElement | null>;
  prompt: string;
  setPrompt: (value: string) => void;
  notice: string;
  setNotice: (value: string) => void;
  attachments: TaskAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<TaskAttachment[]>>;
  mode: WorkMode;
  setMode: (mode: WorkMode) => void;
  selectedExpert: string;
  setSelectedExpert: (name: string) => void;
  selectedSkill: string;
  setSelectedSkill: (name: string) => void;
  expertMatch: ReturnType<typeof useExpertMatch>;
  model: string;
  setModel: (id: string) => void;
  modelOptions: ModelOption[];
  modelMenuOpen: boolean;
  setModelMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  maxMode: boolean;
  setMaxMode: React.Dispatch<React.SetStateAction<boolean>>;
  thinkingMode: "balanced" | "extreme";
  setThinkingMode: (value: "balanced" | "extreme") => void;
  busy: boolean;
  workspace: string;
  workspaceDisplay: string;
  workspaceStorageHint: string;
  workspaceOptions: SpaceOption[];
  pickWorkspace: (next: string) => void;
  permission: string;
  permissionHints: Record<string, string>;
  pickPermission: (next: string) => void;
  openLocalFolder: (files: FileList | null) => Promise<void>;
  startProject: (initialPrompt?: string, projectName?: string, workflow?: "chat" | "skills") => void;
  selectHomeScene: (scene: Pick<HomeScene, "mode" | "prompt">) => boolean;
  recentItems: RecentItem[];
  go: (path: string) => void;
}

export function HomeComposerSection({
  t,
  composerRef,
  fileInputRef,
  folderInputRef,
  modelMenuRef,
  prompt,
  setPrompt,
  notice,
  setNotice,
  attachments,
  setAttachments,
  mode,
  setMode,
  selectedExpert,
  setSelectedExpert,
  selectedSkill,
  setSelectedSkill,
  expertMatch,
  model,
  setModel,
  modelOptions,
  modelMenuOpen,
  setModelMenuOpen,
  maxMode,
  setMaxMode,
  thinkingMode,
  setThinkingMode,
  busy,
  workspace,
  workspaceDisplay,
  workspaceStorageHint,
  workspaceOptions,
  pickWorkspace,
  permission,
  permissionHints,
  pickPermission,
  openLocalFolder,
  startProject,
  selectHomeScene,
  recentItems,
  go,
}: HomeComposerSectionProps) {
  return (
    <main className="main-workspace home-workspace-v2 home27 home-launcher">
      <div className="home-content home-content-v2 home27-content">
        <header className="welcome-header home27-hero">
          <div className="home27-hero-copy">
            <h1>{t("home.title")}</h1>
          </div>
        </header>
        <section ref={composerRef} className="composer-shell" aria-label={t("home.composer.shell")}>
          <div className="composer-main">
            {attachments.length > 0 && (
              <div className="attachment-list">
                {attachments.map((file, index) => (
                  <span
                    className="attachment-chip"
                    key={`${file.name}-${index}`}
                    title={file.text ? "文本内容已读取" : "暂不支持读取此文件类型"}
                  >
                    ▧ {file.name}
                    {file.text ? " ✓" : ""}
                    <button
                      aria-label={`移除附件 ${file.name}`}
                      onClick={() => setAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <PromptInput
              value={prompt}
              onChange={(value) => {
                setPrompt(value);
                setNotice("");
              }}
              onSubmit={startProject}
              placeholder={t("home.composer.ph")}
              rows={1}
              ariaLabel={t("home.composer.aria")}
              autoResize
            />
            <HomeSkillHint
              selected={selectedSkill}
              attachmentCount={attachments.length}
              onUpload={() => fileInputRef.current?.click()}
              onClear={() => setSelectedSkill("")}
            />
            <div className="composer-controls">
              <HomeAttachMenu
                mode={mode}
                selectedExpert={selectedExpert}
                extraExperts={expertMatch.profiles}
                expertLabel={expertMatch.label}
                expertAvatarName={expertMatch.profile?.name}
                expertPanel={(onManual, onClose) => (
                  <ExpertMatchPanel
                    match={expertMatch}
                    onManual={onManual}
                    onClose={onClose}
                    onSelect={(name) => {
                      onClose();
                      setSelectedExpert(name);
                      setNotice("");
                      requestAnimationFrame(() =>
                        composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }),
                      );
                    }}
                    onConfigure={() => {
                      onClose();
                      openSettings("models");
                    }}
                    onViewDetails={
                      expertMatch.profile && expertMatch.profile.id !== "manual"
                        ? () => {
                            onClose();
                            go(`/experts/${encodeURIComponent(expertMatch.profile!.id)}`);
                          }
                        : undefined
                    }
                  />
                )}
                selectedSkill={selectedSkill}
                onOpen={() => setModelMenuOpen(false)}
                onUpload={() => fileInputRef.current?.click()}
                onStartFileTask={() => startProject(prompt.trim(), undefined, "skills")}
                onModeChange={setMode}
                onExpertSelect={(name) => {
                  setSelectedExpert(name);
                  setNotice(name ? "已手动指定专家，不会随输入自动替换；发送时将带入工作规范。" : "已取消手动指定。");
                  requestAnimationFrame(() =>
                    composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }),
                  );
                }}
                onSkillSelect={(name, requirement) => {
                  setSelectedSkill(name);
                  setNotice(requirement || "已选择技能任务说明，请描述需求后发送。此操作不会安装或执行外部程序。");
                  requestAnimationFrame(() =>
                    composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }),
                  );
                }}
                onNavigate={go}
              />
              <input
                ref={folderInputRef}
                className="visually-hidden-input-folder"
                type="file"
                multiple
                onChange={(event) => {
                  const files = event.currentTarget.files;
                  event.currentTarget.value = "";
                  void openLocalFolder(files);
                }}
                {...{ webkitdirectory: "", directory: "" }}
              />
              <input
                ref={fileInputRef}
                className="visually-hidden-input attachment-input"
                type="file"
                multiple
                onChange={(event) => {
                  const selected = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                  if (!selected.length) return;
                  void Promise.all(
                    selected.map(async (file): Promise<TaskAttachment> => {
                      if (file.size <= 5_000_000) {
                        try {
                          const asset = await uploadAsset(file);
                          return { name: file.name, text: asset.extracted ? asset.excerpt : undefined, assetId: asset.id };
                        } catch {
                          /* fall back to reading the file in the browser */
                        }
                      }
                      if (!textAttachmentExtensions.test(file.name) && !file.type.startsWith("text/")) return { name: file.name };
                      if (file.size > 160_000) return { name: file.name };
                      try {
                        return { name: file.name, text: (await file.text()).slice(0, 80_000) };
                      } catch {
                        return { name: file.name };
                      }
                    }),
                  ).then((parsed) => {
                    setAttachments((current) => [...current, ...parsed].slice(-4));
                    const readable = parsed.filter((file) => file.text).length;
                    const stored = parsed.filter((file) => file.assetId).length;
                    setNotice(
                      stored
                        ? `已上传 ${stored} 个附件到服务器素材库${readable ? `，其中 ${readable} 个由服务器解析出文本` : "（非文本文件只保存不解析）"}。`
                        : readable
                          ? `已读取 ${readable} 个文本附件；每个文件最多提取 80 KB 文本。PDF 和图片仅附上文件名。`
                          : "已添加附件。当前只会解析文本文件，PDF 与图片内容暂未提取。",
                    );
                  });
                }}
              />
              <div className="composer-actions-right">
                <div className="model-picker-host" ref={modelMenuRef}>
                  <button
                    className="model-picker"
                    type="button"
                    aria-label="选择大模型"
                    aria-haspopup="dialog"
                    aria-expanded={modelMenuOpen}
                    onClick={() => setModelMenuOpen((open) => !open)}
                  >
                    <span className="model-spark">
                      <ModelGlyph id={model} />
                    </span>
                    <span>{modelOptions.find((option) => option.id === model)?.name ?? model}</span>
                    <span className={modelMenuOpen ? "model-chevron is-open" : "model-chevron"}>
                      <HomeIcon name="chevron" size={10} />
                    </span>
                  </button>
                  {modelMenuOpen && (
                    <HomeModelMenu
                      model={model}
                      maxMode={maxMode}
                      thinkingMode={thinkingMode}
                      onMaxChange={() => setMaxMode((enabled) => !enabled)}
                      onThinkingChange={setThinkingMode}
                      onSelect={(id) => {
                        setModel(id);
                        setModelMenuOpen(false);
                        requestAnimationFrame(() =>
                          modelMenuRef.current?.querySelector<HTMLButtonElement>(".model-picker")?.focus(),
                        );
                      }}
                      onConfigure={() => {
                        setModelMenuOpen(false);
                        openSettings("models", modelMenuRef.current?.querySelector<HTMLButtonElement>(".model-picker"));
                      }}
                    />
                  )}
                </div>
                <button
                  className="microphone-button"
                  title="语音输入"
                  aria-label="语音输入"
                  onClick={() => setNotice("语音输入暂未接入，请直接在输入框中描述任务。")}
                >
                  <HomeIcon name="microphone" size={15} />
                </button>
                <button
                  className={isPptPrompt(prompt) ? "send-button is-ppt" : "send-button"}
                  disabled={busy || !prompt.trim()}
                  title={isPptPrompt(prompt) ? "一键生成 PPTX" : t("home.send")}
                  aria-label={isPptPrompt(prompt) ? "生成演示文稿" : t("home.send")}
                  onClick={() => startProject()}
                >
                  {busy ? "…" : isPptPrompt(prompt) ? <>生成 PPT</> : <HomeIcon name="send" size={19} />}
                </button>
              </div>
            </div>
          </div>
        </section>
        <div className="composer-footer">
          <HomeWorkspacePicker
            value={workspace}
            display={workspaceDisplay}
            storageHint={workspaceStorageHint}
            spaces={workspaceOptions}
            onSelect={pickWorkspace}
            onNewSpace={() => go("/workspaces")}
            onOpenFolder={() => folderInputRef.current?.click()}
          />
          <label className="footer-select" title="执行前是否联网、是否需要再次确认">
            <HomeIcon name="shield" />
            <select
              style={{
                width: `calc(${Math.max(
                  t("home.permission.default").length,
                  t("home.permission.local").length,
                  t("home.permission.confirm").length,
                  permission.length,
                )}em + 4px)`,
              }}
              value={permission}
              onChange={(event) => pickPermission(event.target.value)}
              aria-label={t("home.permission.aria")}
            >
              <option value="默认权限">{t("home.permission.default")}</option>
              <option value="仅本地">仅本地 · 不联网</option>
              <option value="需要确认后执行">需要确认后执行 · 发送前问一次</option>
              {!["默认权限", "仅本地", "需要确认后执行"].includes(permission) && (
                <option value={permission}>{permission}</option>
              )}
            </select>
            <HomeIcon name="chevron" size={10} />
          </label>
          <span className="composer-policy">{permissionHints[permission] ?? permission}</span>
          <span className="composer-hint">
            <kbd>⌘K</kbd> 找场景、技能与插件
          </span>
        </div>

        {notice && (
          <div className="home-notice" role="status">
            <span aria-hidden="true">ⓘ</span>
            <span>{notice}</span>
            <button aria-label={t("home.notice.close")} onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}

        <HomeSuggestionBar mode={mode} prompt={prompt} onSelect={selectHomeScene} />

        <HomeRecent
          items={recentItems}
          onOpen={(item) => go(item.kind === "deck" ? `/ppt/${encodeURIComponent(item.id)}` : projectTaskPath(item.id))}
          onAll={() => go("/projects")}
        />
      </div>
    </main>
  );
}
