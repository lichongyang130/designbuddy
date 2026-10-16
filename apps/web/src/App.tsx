import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DesignLibrary, ProjectEditorPage, ProjectsPage, ShareProjectPage, StudioPage, WorkspaceHub } from "../../../frontend/workspace";
import type { DesignProject } from "../../../frontend/workspace/models/project";
import { createProject, listProjects, updateProject } from "../../../frontend/workspace/projectStore";
import { useExpertMatch } from "./components/useExpertMatch";
import { ExpertMatchPanel } from "./components/ExpertMatchPanel";
import { PromptInput } from "../../../frontend/workspace";
import { navigateTo, normalizeAppPath } from "../../../frontend/workspace/workspaceRoutes";
import { HomeIcon, type HomeIconName } from "./components/HomeIcon";
import { modeLabels } from "./components/homeScenes";
import { HomeModeIcon } from "./components/HomeModeIcon";
import { HomeAttachMenu } from "./components/HomeAttachMenu";
import { HomeModelMenu, ModelGlyph } from "./components/HomeModelMenu";
import { WorkBuddySidebar } from "./components/WorkBuddySidebar";
import PluginsPage from "../../../frontend/workspace/pages/PluginsPage";
import SchedulesPage from "../../../frontend/workspace/pages/SchedulesPage";
import ModelsPage from "../../../frontend/workspace/pages/ModelsPage";
import ProfilePage from "../../../frontend/workspace/pages/ProfilePage";
import WorkspacesPage from "../../../frontend/workspace/pages/WorkspacesPage";
import AssetsPage from "../../../frontend/workspace/pages/AssetsPage";
import { listAssets, uploadAsset } from "../../../frontend/workspace/api/assets";
import { fetchAccount } from "../../../frontend/workspace/api/account";
import InspirationPage from "./inspiration/InspirationPage";
import TaskConversationPage from "../../../frontend/workspace/pages/TaskConversationPage";
import { saveTaskConversation, pendingTaskKey, type TaskConversation } from "../../../frontend/workspace/taskConversation";
import { openSettings, syncPreferencesFromAccount, useModelOptions } from "../../../frontend/workspace/settingsStore";
import { listWorkspaces } from "../../../frontend/workspace/api/workspaces";
import "./styles.css";
import "./home-workspace.css";
import "./home-reference.css";
import "./home-layout.css";
import { HomeDiscovery, HomeShortcuts, type HomeScene } from "./components/HomeDiscovery";


type WorkMode = "office" | "code" | "design";
type TaskAttachment = { name: string; text?: string; assetId?: string };
const textAttachmentExtensions = /\.(txt|md|markdown|json|html|htm|css|js|csv|xml|yaml|yml)$/i;

const quickActions: { title: string; icon: HomeIconName; mode: WorkMode; prompt: string }[] = [
  { title: "文档处理", icon: "document", mode: "office", prompt: "帮我整理和处理这份文档，提炼关键信息并输出清晰的结果。" },
  { title: "金融服务", icon: "wallet", mode: "office", prompt: "帮我整理金融服务需求并生成一份结构清晰的分析方案。" },
  { title: "数据分析及可视化", icon: "chart", mode: "office", prompt: "分析这些数据，并设计清晰易读的数据可视化看板。" },
  { title: "个人工作台", icon: "grid", mode: "office", prompt: "为我规划一个高效、清晰的个人工作台。" },
  { title: "幻灯片", icon: "slides", mode: "office", prompt: "根据我的主题制作一份结构清晰、视觉精美的演示文稿。" },
  { title: "网页设计", icon: "palette", mode: "code", prompt: "帮我设计一个现代、简洁、具有高品质视觉风格的网站首页。" },
];

const modes: { id: WorkMode; label: string; icon: HomeIconName }[] = [
  { id: "office", label: modeLabels.office, icon: "coffee" },
  { id: "design", label: modeLabels.design, icon: "palette" },
  { id: "code", label: modeLabels.code, icon: "code" },
];



function isWorkspaceHubPath(path: string) {
  return path.startsWith("/experts") || path.startsWith("/skills") || path.startsWith("/connectors");
}

export default function App() {
  const modelOptions = useModelOptions();
  const [currentPath, setCurrentPath] = useState(normalizeAppPath(window.location.pathname));
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<WorkMode>("office");
  const [promptGroups, setPromptGroups] = useState<Record<WorkMode, string>>({ office: "office-documents-1", code: "web-corporate-1", design: "design-posters-1" });
  const [promptGroupRevision, setPromptGroupRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [projects, setProjects] = useState<DesignProject[]>(() => listProjects());
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [maxMode, setMaxMode] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<"balanced" | "extreme">("balanced");
  const [workspace, setWorkspace] = useState("默认工作空间");
  const [permission, setPermission] = useState("默认权限");
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [selectedExpert, setSelectedExpert] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const expertMatch = useExpertMatch({ prompt, mode, model, permission, attachments, selectedExpert, enabled: currentPath === "/" });

  useEffect(() => {
    void syncPreferencesFromAccount();
  }, []);

  // The sidebar shows how many workspaces the account belongs to.
  useEffect(() => {
    let cancelled = false;
    void listWorkspaces()
      .then((list) => { if (!cancelled) setWorkspaceCount(list.length); })
      .catch(() => { if (!cancelled) setWorkspaceCount(0); });
    return () => { cancelled = true; };
  }, [currentPath]);

  // The sidebar shows how many files the account owns in the server library.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([listAssets().catch(() => []), fetchAccount().catch(() => null)])
      .then(([assets, identity]) => {
        if (cancelled) return;
        setAssetCount(identity ? assets.filter((asset) => asset.ownerId === identity.id).length : assets.length);
      })
      .catch(() => { if (!cancelled) setAssetCount(0); });
    return () => { cancelled = true; };
  }, [currentPath]);

  useEffect(() => {
    const syncPath = () => {
      setCurrentPath(normalizeAppPath(window.location.pathname));
      setProjects(listProjects());
    };
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    if (currentPath !== "/") return;
    const key = "designbuddy.launch-context.v1";
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;
    window.sessionStorage.removeItem(key);
    try {
      const context = JSON.parse(raw) as { expert?: unknown; skill?: unknown; prompt?: unknown; mode?: unknown };
      if (typeof context.prompt === "string") {
        if (prompt.trim() && prompt !== context.prompt && !window.confirm("输入框已有内容，是否替换为此专家任务示例？附件、模型、工作空间和权限将保留。")) {
          setNotice("已保留原始需求，未更换专家或填入任务示例。");
          return;
        }
        setPrompt(context.prompt);
        if (["office", "design", "code"].includes(String(context.mode))) setMode(context.mode as WorkMode);
        requestAnimationFrame(() => composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }));
      }
      if (typeof context.expert === "string") setSelectedExpert(context.expert);
      if (typeof context.skill === "string") setSelectedSkill(context.skill);
      setNotice(typeof context.prompt === "string" ? "已填入完整任务示例并锁定专家，尚未发送。" : "已载入所选专家/技能，原有输入与设置已保留。");
    } catch { setNotice("无法读取所选专家或技能，请重新选择。"); }
  }, [currentPath]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !modelMenuRef.current?.contains(event.target)) setModelMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModelMenuOpen(false);
        modelMenuRef.current?.querySelector<HTMLButtonElement>(".model-picker")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [modelMenuOpen]);

  useLayoutEffect(() => {
    if (!modelMenuOpen) return;
    const host = modelMenuRef.current;
    const panel = host?.querySelector<HTMLElement>(".model-menu-popover");
    const trigger = host?.querySelector<HTMLElement>(".model-picker");
    if (!panel || !trigger) return;
    const place = () => {
      const anchor = trigger.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      const above = anchor.top - bounds.height - 10;
      panel.style.left = `${Math.max(12, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 12))}px`;
      panel.style.top = `${Math.max(12, Math.min(above >= 12 ? above : anchor.bottom + 10, window.innerHeight - bounds.height - 12))}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [modelMenuOpen]);

  useEffect(() => {
    if (!modelOptions.some(option => option.id === model)) setModel("");
  }, [modelOptions, model]);

  function go(path: string) {
    navigateTo(path);
    setCurrentPath(normalizeAppPath(window.location.pathname));
    setProjects(listProjects());
    setNotice("");
  }

  function selectHomeScene(scene: Pick<HomeScene, "mode" | "prompt">) {
    if (prompt.trim() && prompt !== scene.prompt && !window.confirm("输入框已有内容，是否替换为此场景的任务提示？附件、模型、工作空间和权限将保留。")) return false;
    setMode(scene.mode);
    setPrompt(scene.prompt);
    setSelectedSkill("");
    setNotice("");
    requestAnimationFrame(() => {
      const input = composerRef.current?.querySelector("textarea");
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
    return true;
  }

  function startProject(initialPrompt = prompt.trim(), projectName?: string, workflow: "chat" | "skills" = "chat") {
    if (!initialPrompt.trim() && !projectName) {
      setNotice("先描述你的想法，或选择一个快捷场景开始。");
      return;
    }
    try {
      setBusy(true);
      const prefix = `${modeLabels[mode]}需求：`;
      if (workflow !== "skills" && !selectedExpert && expertMatch.result?.kind === "clarify" && initialPrompt.trim() === prompt.trim()) {
        setNotice("请点击「需要确认需求」回答一个关键问题；也可手动指定专家或关闭自动匹配后直接发送。");
        return;
      }
      const sameDraft = initialPrompt.trim() === prompt.trim();
      const expertPrefix = (selectedExpert || sameDraft) ? expertMatch.executionBrief : "";
      const confirmedContext = sameDraft ? expertMatch.confirmedContext : "";
      const skillPrefix = selectedSkill ? `使用技能：${selectedSkill}。` : "";
      const hasModePrefix = [...Object.values(modeLabels), "日常办公", "代码开发", "设计创意"].some(label => initialPrompt.startsWith(`${label}需求：`));
      const task = hasModePrefix ? `${expertPrefix}${skillPrefix}${initialPrompt}` : `${prefix}${expertPrefix}${skillPrefix}${initialPrompt}`;
      const request = `工作空间：${workspace}；执行策略：${permission}。\n${task}`;
      const attachmentContext = attachments.filter((item) => item.text || item.assetId).map((item) => `\n\n--- 附件：${item.name}${item.assetId ? `（服务器素材 ${item.assetId}）` : ""} ---\n${item.text ?? ""}`).join("");
      const fullRequest = request + confirmedContext + attachmentContext;
      const draft = createProject(fullRequest, projectName || initialPrompt.trim().slice(0, 36));
      const project = updateProject({ ...draft, workspaceName: workspace, executionPolicy: permission });
      const conversation: TaskConversation = {
        projectId: project.id, mode, model, permission, workflow,
        skillExpertId: (selectedExpert || sameDraft) ? expertMatch.profile?.id : undefined,
        messages: [{ id: crypto.randomUUID(), role: "user", content: initialPrompt.trim(), requestContent: fullRequest, replyMode: (selectedExpert || sameDraft) ? expertMatch.replyMode : undefined, requirementsConfirmed: !!confirmedContext, createdAt: new Date().toISOString(), status: "complete" }],
      };
      saveTaskConversation(conversation);
      try { if (workflow !== "skills") sessionStorage.setItem(pendingTaskKey(project.id), "1"); }
      catch {
        conversation.messages.push({ id: crypto.randomUUID(), role: "assistant", content: "", createdAt: new Date().toISOString(), status: "error", error: "浏览器不允许自动提交，请点击重新生成。" });
        saveTaskConversation(conversation);
      }
      setProjects(listProjects());
      setNotice("");
      setPrompt("");
      expertMatch.reset();
      setSelectedExpert("");
      setSelectedSkill("");
      setAttachments([]);
      go(`/tasks/${encodeURIComponent(project.id)}`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "项目创建失败，请检查浏览器存储设置。");
    } finally {
      setBusy(false);
    }
  }

  if (currentPath === "/plugins") return <PluginsPage />;
  if (currentPath === "/schedules") return <SchedulesPage />;
  if (currentPath === "/models") return <ModelsPage />;
  if (currentPath === "/profile") return <ProfilePage />;
  if (currentPath === "/workspaces") return <WorkspacesPage />;
  if (currentPath === "/assets") return <AssetsPage />;
  if (currentPath === "/inspiration" || currentPath.startsWith("/inspiration/")) return <InspirationPage pathname={currentPath} />;
  if (currentPath.startsWith("/library")) return <DesignLibrary />;
  if (currentPath === "/studio" || currentPath.startsWith("/studio/")) return <StudioPage />;
  if (currentPath === "/share") return <ShareProjectPage />;
  const shareMatch = currentPath.match(/^\/share\/([^/]+)$/);
  if (shareMatch) return <ShareProjectPage token={decodeURIComponent(shareMatch[1])} />;
  if (isWorkspaceHubPath(currentPath)) return <WorkspaceHub />;
  const taskMatch = currentPath.match(/^\/tasks\/([^/]+)$/);
  if (taskMatch) {
    let id = taskMatch[1];
    try { id = decodeURIComponent(id); } catch { /* Show the not-found view. */ }
    return <TaskConversationPage key={id} projectId={id} />;
  }
  const editorMatch = currentPath.match(/^\/editor\/([^/]+)$/);
  if (editorMatch) {
    let projectId = editorMatch[1];
    try { projectId = decodeURIComponent(projectId); } catch { /* Keep the raw id for the not-found screen. */ }
    return <ProjectEditorPage projectId={projectId} />;
  }
  if (currentPath === "/projects") return <ProjectsPage />;

  return (
    <div className="workbuddy-app">
      <WorkBuddySidebar active="home" projectCount={projects.length} workspaceCount={workspaceCount} assetCount={assetCount} go={go} setNotice={setNotice} />

      <main className="main-workspace home-workspace-v2 home27">
        <div className="home-content home-content-v2 home27-content">
          <header className="welcome-header home27-hero">
            <div className="home27-hero-copy">
              <h1>DesignBuddy 让工作更高效</h1>
            </div>
          </header>
          <div className="home27-mode-row">
            <div className="mode-switch" role="tablist" aria-label="任务模式">
              {modes.map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={mode === item.id}
                  tabIndex={mode === item.id ? 0 : -1}
                  onKeyDown={(event) => {
                    const index = modes.findIndex((entry) => entry.id === item.id);
                    const next = event.key === "ArrowRight" ? (index + 1) % modes.length
                      : event.key === "ArrowLeft" ? (index + modes.length - 1) % modes.length
                      : event.key === "Home" ? 0 : event.key === "End" ? modes.length - 1 : -1;
                    if (next < 0) return;
                    event.preventDefault();
                    setMode(modes[next].id);
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
                  }}
                  className={`mode-tab ${mode === item.id ? "is-selected" : ""}`}
                  onClick={() => setMode(item.id)}
                >
                  <HomeModeIcon mode={item.id} />{item.label}
                </button>
              ))}
            </div>
          </div>

          <HomeShortcuts mode={mode} activeGroupId={promptGroups[mode]} onGroupSelect={id => { setPromptGroups(current => ({ ...current, [mode]: id })); setPromptGroupRevision(n => n + 1); }} />

          <section ref={composerRef} className="composer-shell" aria-label="创建任务">
            <div className="composer-main">
              {attachments.length > 0 && (
                <div className="attachment-list">
                  {attachments.map((file, index) => (
                    <span className="attachment-chip" key={`${file.name}-${index}`} title={file.text ? "文本内容已读取" : "暂不支持读取此文件类型"}>
                      ▧ {file.name}{file.text ? " ✓" : ""}
                      <button aria-label={`移除附件 ${file.name}`} onClick={() => setAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <PromptInput
                value={prompt}
                onChange={(value) => { setPrompt(value); setNotice(""); }}
                onSubmit={startProject}
                placeholder="描述你的想法，例如：制作一个产品介绍PPT…"
                rows={3}
                ariaLabel="任务描述"
                autoResize
              />
              {selectedSkill && <div className="home-selected-capabilities"><span>任务说明预设：{selectedSkill}</span><button type="button" onClick={() => setSelectedSkill("")}>清除</button></div>}
              <div className="composer-controls">
                <HomeAttachMenu
                  mode={mode}
                  selectedExpert={selectedExpert}
                  extraExperts={expertMatch.profiles}
                  expertLabel={expertMatch.label}
                  expertAvatarName={expertMatch.profile?.name}
                  expertPanel={(onManual, onClose) => <ExpertMatchPanel match={expertMatch} onManual={onManual} onClose={onClose} onSelect={name => {
                    onClose(); setSelectedExpert(name); setNotice("");
                    requestAnimationFrame(() => composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }));
                  }} onConfigure={() => { onClose(); openSettings("models"); }} onViewDetails={expertMatch.profile && expertMatch.profile.id !== "manual" ? () => { onClose(); go(`/experts/${encodeURIComponent(expertMatch.profile!.id)}`); } : undefined} />}
                  selectedSkill={selectedSkill}
                  onOpen={() => setModelMenuOpen(false)}
                  onUpload={() => fileInputRef.current?.click()}
                  onStartFileTask={() => startProject(prompt.trim(), undefined, "skills")}
                  onModeChange={setMode}
                  onExpertSelect={name => {
                    setSelectedExpert(name);
                    setNotice(name ? "已手动指定专家，不会随输入自动替换；发送时将带入工作规范。" : "已取消手动指定。");
                    requestAnimationFrame(() => composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }));
                  }}
                  onSkillSelect={(name, requirement) => {
                    setSelectedSkill(name);
                    setNotice(requirement || "已选择技能任务说明，请描述需求后发送。此操作不会安装或执行外部程序。");
                    requestAnimationFrame(() => composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }));
                  }}
                  onNavigate={go}
                />
                <input
                  ref={fileInputRef}
                  className="visually-hidden-input"
                  type="file"
                  multiple
                  onChange={(event) => {
                    const selected = Array.from(event.currentTarget.files ?? []);
                    event.currentTarget.value = "";
                    if (!selected.length) return;
                    void Promise.all(selected.map(async (file): Promise<TaskAttachment> => {
                      // The server stores the file in the asset library and parses
                      // text files there, so the task can be continued on another
                      // device. When the server is not reachable the browser still
                      // reads small text files.
                      if (file.size <= 5_000_000) {
                        try {
                          const asset = await uploadAsset(file);
                          return { name: file.name, text: asset.extracted ? asset.excerpt : undefined, assetId: asset.id };
                        } catch { /* fall back to reading the file in the browser */ }
                      }
                      if (!textAttachmentExtensions.test(file.name) && !file.type.startsWith("text/")) return { name: file.name };
                      if (file.size > 160_000) return { name: file.name };
                      try { return { name: file.name, text: (await file.text()).slice(0, 80_000) }; }
                      catch { return { name: file.name }; }
                    })).then((parsed) => {
                      setAttachments((current) => [...current, ...parsed].slice(-4));
                      const readable = parsed.filter((file) => file.text).length;
                      const stored = parsed.filter((file) => file.assetId).length;
                      setNotice(stored
                        ? `已上传 ${stored} 个附件到服务器素材库${readable ? `，其中 ${readable} 个由服务器解析出文本` : "（非文本文件只保存不解析）"}。`
                        : readable ? `已读取 ${readable} 个文本附件；每个文件最多提取 80 KB 文本。PDF 和图片仅附上文件名。` : "已添加附件。当前只会解析文本文件，PDF 与图片内容暂未提取。");
                    });
                  }}
                />
                <div className="composer-actions-right">
                  <div className="model-picker-host" ref={modelMenuRef}>
                    <button className="model-picker" type="button" aria-label="选择大模型" aria-haspopup="dialog" aria-expanded={modelMenuOpen} onClick={() => setModelMenuOpen((open) => !open)}>
                      <span className="model-spark"><ModelGlyph id={model} /></span><span>{modelOptions.find((option) => option.id === model)?.name ?? model}</span><span className={modelMenuOpen ? "model-chevron is-open" : "model-chevron"}><HomeIcon name="chevron" size={10} /></span>
                    </button>
                    {modelMenuOpen && <HomeModelMenu
                      model={model}
                      maxMode={maxMode}
                      thinkingMode={thinkingMode}
                      onMaxChange={() => setMaxMode(enabled => !enabled)}
                      onThinkingChange={setThinkingMode}
                      onSelect={id => {
                        setModel(id);
                        setModelMenuOpen(false);
                        requestAnimationFrame(() => modelMenuRef.current?.querySelector<HTMLButtonElement>(".model-picker")?.focus());
                      }}
                      onConfigure={() => {
                        setModelMenuOpen(false);
                        openSettings("models", modelMenuRef.current?.querySelector<HTMLButtonElement>(".model-picker"));
                      }}
                    />}
                  </div>
                  <button className="microphone-button" title="语音输入" aria-label="语音输入" onClick={() => setNotice("语音输入暂未接入，请直接在输入框中描述任务。")}><HomeIcon name="microphone" size={15} /></button>
                  <button className="send-button" disabled={busy || !prompt.trim()} title="开始任务" aria-label="开始任务" onClick={() => startProject()}>
                    {busy ? "…" : <HomeIcon name="send" size={19} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="composer-footer">
              <label className="footer-select">
                <HomeIcon name="folder" />
                <select value={workspace} onChange={(event) => setWorkspace(event.target.value)} aria-label="工作空间">
                  <option value="默认工作空间">选择工作空间</option>
                  <option>个人空间</option>
                  <option>产品设计空间</option>
                </select>
                <HomeIcon name="chevron" size={10} />
              </label>
              <label className="footer-select">
                <HomeIcon name="shield" />
                <select style={{ width: `calc(${permission.length}em + 4px)` }} value={permission} onChange={(event) => setPermission(event.target.value)} aria-label="任务权限">
                  <option>默认权限</option>
                  <option>仅本地</option>
                  <option>需要确认后执行</option>
                </select>
                <HomeIcon name="chevron" size={10} />
              </label>
            </div>
          </section>


          {notice && (
            <div className="home-notice" role="status">
              <span aria-hidden="true">ⓘ</span>
              <span>{notice}</span>
              <button aria-label="关闭提示" onClick={() => setNotice("")}>×</button>
            </div>
          )}
          <HomeDiscovery mode={mode} groupId={promptGroups[mode]} selectionVersion={promptGroupRevision} prompt={prompt} onSelect={selectHomeScene} />
          <details className="home27-more-scenes">
            <summary>更多快捷场景 <span aria-hidden="true">＋</span></summary>
            <div>{quickActions.filter(action => action.mode === mode).map(action => <button key={action.title} onClick={() => selectHomeScene(action)}><HomeIcon name={action.icon} />{action.title}</button>)}</div>
          </details>
          <button className="home27-explore" onClick={() => go("/plugins")}><span aria-hidden="true">—</span> 探索更多 AI 能力 <span aria-hidden="true">→</span></button>
        </div>
      </main>
    </div>
  );
}
