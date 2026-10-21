import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ProjectEditorPage, ProjectsPage, ShareProjectPage, StudioPage, WorkspaceHub } from "../../../frontend/workspace";
import type { DesignProject } from "../../../frontend/workspace/models/project";
import { createProject, listProjects, updateProject } from "../../../frontend/workspace/projectStore";
import { useExpertMatch } from "./components/useExpertMatch";
import { ExpertMatchPanel } from "./components/ExpertMatchPanel";
import { PromptInput } from "../../../frontend/workspace";
import { navigateTo, normalizeAppPath } from "../../../frontend/workspace/workspaceRoutes";
import { HomeIcon, type HomeIconName } from "./components/HomeIcon";
import { modeLabels } from "./components/homeScenes";
import PptPage from "../../../frontend/workspace/pages/PptPage";
import PptOutlinePicker from "../../../frontend/workspace/pages/PptOutlinePicker";
import PptSharePage from "../../../frontend/workspace/pages/PptSharePage";
import { isPptPrompt, listPptProjects } from "../../../frontend/workspace/pptStore";
import { HomeAttachMenu } from "./components/HomeAttachMenu";
import { HomeModelMenu, ModelGlyph } from "./components/HomeModelMenu";
import { WorkBuddySidebar } from "./components/WorkBuddySidebar";
import SchedulesPage from "../../../frontend/workspace/pages/SchedulesPage";
import ModelsPage from "../../../frontend/workspace/pages/ModelsPage";
import ProfilePage from "../../../frontend/workspace/pages/ProfilePage";
import WorkspacesPage from "../../../frontend/workspace/pages/WorkspacesPage";
import AssetsPage from "../../../frontend/workspace/pages/AssetsPage";
import CommunityPage from "../../../frontend/workspace/pages/CommunityPage";
import WorkflowsPage from "../../../frontend/workspace/pages/WorkflowsPage";
import AdminPage from "../../../frontend/workspace/pages/AdminPage";
import { listAssets, uploadAsset } from "../../../frontend/workspace/api/assets";
import { fetchAccount } from "../../../frontend/workspace/api/account";
import InspirationPage from "./inspiration/InspirationPage";
import { HomeSkillHint } from "./components/HomeSkillHint";
import { HomeCommandPalette } from "./components/HomeCommandPalette";
// Scene samples are heavy (15 mini apps); only load them when ⌘K asks for one.
const ScenePreview = lazy(() => import("./components/ScenePreview").then((module) => ({ default: module.ScenePreview })));
import { selectionGate, useSkillSelection } from "./components/useRuntimeSkill";
import TaskConversationPage from "../../../frontend/workspace/pages/TaskConversationPage";
import { saveTaskConversation, pendingTaskKey, type TaskConversation } from "../../../frontend/workspace/taskConversation";
import { matchBinding, openSettings, setWakeLock, syncPreferencesFromAccount, useModelOptions, usePreferences, useSettingsWindow } from "../../../frontend/workspace/settingsStore";
import { useRuntimeActivity, useRuntimeActivityState } from "../../../frontend/workspace/runtimeActivity";
import { translate } from "../../../frontend/workspace/i18n";
import { listWorkspaces } from "../../../frontend/workspace/api/workspaces";
import "./styles.css";
import "./home-workspace.css";
import "./home-reference.css";
import "./home-layout.css";
import "./home-plugins.css";
import "./home-launcher.css";
import "./command-palette.css";
import { HomeRecent, HomeSuggestionBar, type RecentItem } from "./components/HomeSuggestionBar";
import { DELIVERABLES, MODE_OPTIONS, detectIntent } from "./components/homeIntent";
import type { HomeScene } from "./components/homeScenes";
import { projectTaskPath } from "../../../frontend/workspace/taskConversation";
import "./components/auth.css";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import type { AccountIdentity } from "../../../frontend/workspace/api/account";
import { AUTH_GATE_ENABLED } from "../../../frontend/workspace/authGate";

// The plugin directory ships the whole 480-item catalogue plus its filters, so
// it is loaded on demand: the homepage only renders the small "我的插件" rail.
const PluginsPage = lazy(() => import("../../../frontend/workspace/pages/PluginsPage"));
const ThemesPage = lazy(() => import("../../../frontend/workspace/pages/ThemesPage"));
// The library carries three catalogues (design systems, templates, 480 plugins,
// skills) worth ~400 KB of JSON; nobody needs them to see the homepage.
const DesignLibrary = lazy(() => import("../../../frontend/workspace/pages/DesignLibrary"));


type WorkMode = "office" | "code" | "design";
type TaskAttachment = { name: string; text?: string; assetId?: string };
const textAttachmentExtensions = /\.(txt|md|markdown|json|html|htm|css|js|csv|xml|yaml|yml)$/i;

// Home quick actions come from the catalog, filtered by the user's 6 picks
// in 个性化 settings (see quickActions inside App). Catalog lives in homeScenes.

// The three working modes still exist — they colour the task prefix and the
// examples — but the homepage no longer makes people pick one up front.
// `detectIntent()` reads it from the draft; the chip lets people correct it.



function isWorkspaceHubPath(path: string) {
  return path.startsWith("/experts") || path.startsWith("/skills") || path.startsWith("/connectors");
}

export default function App() {
  const modelOptions = useModelOptions();
  const defaultModel = usePreferences((state) => state.defaultModel);
  const defaultMode = usePreferences((state) => state.defaultMode);
  const defaultWorkspace = usePreferences((state) => state.defaultWorkspace);
  const defaultPermission = usePreferences((state) => state.defaultPermission);
  const [currentPath, setCurrentPath] = useState(normalizeAppPath(window.location.pathname));
  console.log("🔍 Current path:", currentPath, "from URL:", window.location.pathname);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<WorkMode>(() => usePreferences.getState().defaultMode || "office");
  // The mode is inferred from the draft until someone picks one by hand.
  const [modeLocked, setModeLocked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [projects, setProjects] = useState<DesignProject[]>(() => listProjects());
  const [identity, setIdentity] = useState<AccountIdentity | null | undefined>(undefined);
  const [identityFailed, setIdentityFailed] = useState(false);
  const [identityAttempt, setIdentityAttempt] = useState(0);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(() => usePreferences.getState().defaultModel || "agnes-3.0-flash");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [maxMode, setMaxMode] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<"balanced" | "extreme">("balanced");
  const [workspace, setWorkspace] = useState(() => usePreferences.getState().defaultWorkspace || "默认工作空间");
  const [permission, setPermission] = useState(() => usePreferences.getState().defaultPermission || "默认权限");
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [selectedExpert, setSelectedExpert] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Interactive scene samples used to sit in a 15-card gallery on the launcher.
  // They now open from ⌘K, so the first screen stays a single input.
  const [previewScene, setPreviewScene] = useState<HomeScene | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const startProjectRef = useRef<() => void>(() => {});
  const expertMatch = useExpertMatch({ prompt, mode, model, permission, attachments, selectedExpert, enabled: currentPath === "/" });
  const skillSelection = useSkillSelection(selectedSkill);

  useEffect(() => {
    void syncPreferencesFromAccount();
  }, []);

  // Read the mode from what is being typed. An explicit choice (the chip, a
  // scene, the attach menu) wins for as long as the draft is non-empty.
  useEffect(() => {
    if (!prompt.trim()) {
      setModeLocked(false);
      return;
    }
    if (modeLocked) return;
    const next = detectIntent(prompt).mode;
    setMode((current) => (current === next ? current : next));
  }, [prompt, modeLocked]);

  const intent = useMemo(() => detectIntent(prompt), [prompt]);
  const deliverable = prompt.trim() ? intent.deliverableInfo : null;

  const recentItems = useMemo<RecentItem[]>(() => {
    const decks = listPptProjects().map((deck) => ({
      id: deck.id,
      title: deck.title,
      kind: "deck" as const,
      updatedAt: deck.updatedAt,
    }));
    const tasks = projects.map((project) => ({
      id: project.id,
      title: project.name,
      kind: "project" as const,
      updatedAt: project.updatedAt,
    }));
    return [...decks, ...tasks]
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .slice(0, 3);
  }, [projects]);

  const theme = usePreferences((state) => state.theme);
  const density = usePreferences((state) => state.density);
  const consoleTheme = usePreferences((state) => state.consoleTheme);
  const fontStyle = usePreferences((state) => state.fontStyle);
  const contentWidth = usePreferences((state) => state.contentWidth);
  const fileIcons = usePreferences((state) => state.fileIcons);
  const glassEffects = usePreferences((state) => state.glassEffects);
  const locale = usePreferences((state) => state.locale);
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  // An unset preference is not a mode; keep the composer on a real one.
  useEffect(() => setMode(defaultMode || "office"), [defaultMode]);
  useEffect(() => setModel(defaultModel || "agnes-3.0-flash"), [defaultModel]);
  useEffect(() => setWorkspace(defaultWorkspace || "默认工作空间"), [defaultWorkspace]);
  useEffect(() => setPermission(defaultPermission || "默认权限"), [defaultPermission]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.locale = locale;
    root.lang = locale;
    root.dir = locale === "ar" || locale === "fa" ? "rtl" : "ltr";
  }, [locale]);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const osDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const interfaceDark = theme === "dark" || (theme === "system" && osDark);
      root.dataset.consoleTheme =
        consoleTheme === "dark" || (consoleTheme === "system" && interfaceDark)
          ? "dark"
          : "light";
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [consoleTheme, theme]);
  useEffect(() => {
    document.documentElement.dataset.fontStyle = fontStyle;
  }, [fontStyle]);
  useEffect(() => {
    document.documentElement.dataset.contentWidth = contentWidth;
  }, [contentWidth]);
  useEffect(() => {
    document.documentElement.dataset.fileIcons = fileIcons;
  }, [fileIcons]);
  useEffect(() => {
    document.documentElement.dataset.glass = glassEffects ? "on" : "off";
  }, [glassEffects]);
  useRuntimeActivity(busy);
  const runtimeActivityCount = useRuntimeActivityState((state) => state.activeCount);
  const wakeLockWanted = usePreferences((state) => state.wakeLock);
  const shouldPreventSleep = wakeLockWanted && runtimeActivityCount > 0;
  useEffect(() => {
    let cancelled = false;
    const reportFailure = () => {
      window.dispatchEvent(new Event("designbuddy:wake-lock-failed"));
      try {
        setWakeLock(false);
      } catch {
        // Keep the UI error visible even if storage itself is unavailable.
      }
    };
    const desktop = window.designBuddyDesktop;
    if (desktop) {
      try {
        void desktop.setRuntimeSleepBlocker(shouldPreventSleep).catch(() => {
          if (!cancelled && shouldPreventSleep) reportFailure();
        });
      } catch {
        if (shouldPreventSleep) reportFailure();
      }
      return () => {
        cancelled = true;
        void desktop.setRuntimeSleepBlocker(false).catch(() => {});
      };
    }
    if (!shouldPreventSleep) return;

    type WakeLockSentinelLike = {
      release: () => Promise<void>;
      addEventListener?: (type: string, listener: () => void, options?: unknown) => void;
    };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (kind: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) {
      reportFailure();
      return;
    }

    let sentinel: WakeLockSentinelLike | null = null;
    let requesting = false;
    const release = () => {
      const held = sentinel;
      sentinel = null;
      if (held) void held.release().catch(() => {});
    };
    const acquire = async () => {
      if (cancelled || sentinel || requesting || !nav.wakeLock || document.visibilityState !== "visible") return;
      requesting = true;
      let retryAfterRelease = false;
      try {
        const held = await nav.wakeLock.request("screen");
        if (cancelled || document.visibilityState !== "visible") {
          await held.release().catch(() => {});
          retryAfterRelease = !cancelled && document.visibilityState === "visible";
          return;
        }
        sentinel = held;
        held.addEventListener?.("release", () => {
          const wasCurrent = sentinel === held;
          if (wasCurrent) sentinel = null;
          if (wasCurrent && !cancelled && document.visibilityState === "visible") reportFailure();
        }, { once: true });
      } catch {
        if (!cancelled) reportFailure();
      } finally {
        requesting = false;
        if (retryAfterRelease && !cancelled && !sentinel && document.visibilityState === "visible") void acquire();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
      else release();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [shouldPreventSleep]);
  useEffect(() => {
    const dispatch = (event: KeyboardEvent) => {
      const bindings = usePreferences.getState().keybindings;
      // ⌘K / Ctrl+K: one search for scenes, plugins, skills and pages. The
      // palette lives on the homepage only, so the shortcut is scoped to it.
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        if (currentPath !== "/") return;
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (matchBinding(event, bindings["open-settings"])) {
        event.preventDefault();
        if (!useSettingsWindow.getState().open) openSettings();
        return;
      }
      if (useSettingsWindow.getState().open) return;
      if (matchBinding(event, bindings["go-home"])) {
        event.preventDefault();
        go("/");
        return;
      }
      if (matchBinding(event, bindings["go-templates"])) {
        event.preventDefault();
        go("/inspiration");
        return;
      }
      if (currentPath !== "/") return;
      if (matchBinding(event, bindings["focus-composer"])) {
        event.preventDefault();
        composerRef.current?.querySelector("textarea")?.focus();
        return;
      }
      if (matchBinding(event, bindings["send-task"]) && prompt.trim()) {
        event.preventDefault();
        startProjectRef.current();
      }
    };
    window.addEventListener("keydown", dispatch);
    return () => window.removeEventListener("keydown", dispatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, prompt]);

  // Every launch starts at the login screen until the server confirms an account.
  // Shared links stay public; the login and register pages never gate themselves.
  const publicRoute =
    currentPath === "/login" ||
    currentPath === "/register" ||
    currentPath === "/auth" ||
    currentPath.startsWith("/share");
  useEffect(() => {
    if (publicRoute) return;
    let cancelled = false;
    // The first load blocks on the gate. Later in-app navigations keep the
    // known identity so mounted pages (and their in-flight requests) survive;
    // a background check only interrupts when the session actually changed.
    const known = identity;
    if (known === undefined && !identityFailed) {
      fetchAccount()
        .then((user) => {
          if (!cancelled) setIdentity(user);
        })
        .catch(() => {
          if (!cancelled) {
            setIdentity(null);
            setIdentityFailed(true);
          }
        });
    } else {
      fetchAccount()
        .then((user) => {
          if (cancelled) return;
          if (!known || known.kind !== user.kind || known.id !== user.id) {
            setIdentity(user);
            setIdentityFailed(false);
          }
        })
        .catch(() => {
          // Keep the stale identity; per-feature requests surface outages.
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, publicRoute, identityAttempt]);

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
    if (!modelOptions.some((option) => option.id === model))
      setModel(modelOptions.find((option) => option.id === "agnes-3.0-flash")?.id ?? modelOptions[0]?.id ?? "");
  }, [modelOptions, model]);

  function go(path: string) {
    navigateTo(path);
    setCurrentPath(normalizeAppPath(window.location.pathname));
    setProjects(listProjects());
    setNotice("");
  }

  useEffect(() => {
    if (!AUTH_GATE_ENABLED && (currentPath === "/login" || currentPath === "/register" || currentPath === "/auth")) go("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  function selectHomeScene(scene: Pick<HomeScene, "mode" | "prompt">) {
    if (prompt.trim() && prompt !== scene.prompt && !window.confirm("输入框已有内容，是否替换为此场景的任务提示？附件、模型、工作空间和权限将保留。")) return false;
    setMode(scene.mode);
    setModeLocked(true);
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

  function startPptProject(rawPrompt: string) {
    const promptText = rawPrompt.trim();
    if (!promptText) {
      setNotice("请输入演示主题，例如：Q4 季度复盘 · 运营策略");
      return;
    }
    try {
      setBusy(true);
      // Gamma式：先到大纲页，让用户在 3 套不同框架里选
      const outlineId = crypto.randomUUID();
      sessionStorage.setItem(`designbuddy.ppt.outline.${outlineId}`, JSON.stringify({ prompt: promptText, createdAt: Date.now() }));
      setNotice("");
      setPrompt("");
      expertMatch.reset();
      setSelectedExpert("");
      setSelectedSkill("");
      setAttachments([]);
      go(`/ppt/outline/${encodeURIComponent(outlineId)}`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "演示文稿创建失败");
    } finally {
      setBusy(false);
    }
  }

  function startProject(initialPrompt = prompt.trim(), projectName?: string, workflow: "chat" | "skills" = "chat") {
    if (!initialPrompt.trim() && !projectName) {
      setNotice("先描述你的想法，或选择一个快捷场景开始。");
      return;
    }
    // 首页直出 PPT：只要输入包含 PPT/演示文稿/幻灯片/汇报等关键词，就直接生成可编辑 PPTX
    if (isPptPrompt(initialPrompt)) {
      return startPptProject(initialPrompt);
    }
    // A selected skill is a promise about what will run. Refuse to send when the
    // declaration already says it cannot run, instead of failing inside the task.
    const gate = selectionGate(skillSelection, attachments.length, { requireFile: workflow !== "skills" });
    if (gate) {
      setNotice(`${gate.blocked}${gate.action?.kind === "clear" ? " 清除技能后可退回普通对话。" : ""}`);
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
        suggestedSkillId: expertMatch.skillSuggestion?.skillId,
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
  startProjectRef.current = () => startProject();

  if (AUTH_GATE_ENABLED && (currentPath === "/login" || currentPath === "/auth")) return <LoginPage />;
  if (AUTH_GATE_ENABLED && currentPath === "/register") return <RegisterPage />;
  // Gate off: everyone lands directly in the app. Legacy auth URLs redirect
  // home (see the effect below) and fall through to the home view meanwhile.
  if (AUTH_GATE_ENABLED && !publicRoute) {
    if (identity === undefined && !identityFailed)
      return (
        <div className="auth-loading" role="status" aria-label="正在确认登录状态">
          <span className="auth-loading-spinner" aria-hidden="true" />
          正在确认登录状态…
        </div>
      );
    if (identityFailed || !identity)
      return (
        <div className="auth-loading" role="alert">
          <p>无法连接后台服务，请确认服务已启动后重试。</p>
          <button onClick={() => setIdentityAttempt((attempt) => attempt + 1)}>
            重新连接
          </button>
        </div>
      );
    if (identity.kind !== "account")
      return <LoginPage next={currentPath + window.location.search} />;
  }
  if (currentPath === "/plugins")
    return (
      <Suspense fallback={<div className="auth-loading" role="status" aria-label="正在加载插件页"><span className="auth-loading-spinner" aria-hidden="true" />正在加载插件目录…</div>}>
        <PluginsPage />
      </Suspense>
    );
  if (currentPath === "/themes")
    return (
      <Suspense fallback={<div className="auth-loading" role="status" aria-label="正在加载主题库"><span className="auth-loading-spinner" aria-hidden="true" />正在加载主题库…</div>}>
        <ThemesPage />
      </Suspense>
    );
  if (currentPath === "/schedules") return <SchedulesPage />;
  if (currentPath === "/models") return <ModelsPage />;
  if (currentPath === "/profile") return <ProfilePage />;
  if (currentPath === "/workspaces") return <WorkspacesPage />;
  if (currentPath === "/assets") return <AssetsPage />;
  if (currentPath === "/community") return <CommunityPage />;
  if (currentPath === "/workflows") return <WorkflowsPage />;
  if (currentPath === "/admin") return <AdminPage />;
  if (currentPath === "/inspiration" || currentPath.startsWith("/inspiration/")) return <InspirationPage pathname={currentPath} />;
  if (currentPath.startsWith("/library"))
    return (
      <Suspense fallback={<div className="auth-loading" role="status" aria-label="正在加载素材库"><span className="auth-loading-spinner" aria-hidden="true" />正在加载素材库…</div>}>
        <DesignLibrary />
      </Suspense>
    );
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
  if (typeof window !== "undefined" && /ppt-share/.test(window.location.hash)) return <PptSharePage />;
  if (currentPath === "/ppt" || currentPath === "/ppt/") return <PptPage />;
  const pptOutlineMatch = currentPath.match(/^\/ppt\/outline\/([^/]+)$/);
  if (pptOutlineMatch) {
    let outlineId = pptOutlineMatch[1];
    try { outlineId = decodeURIComponent(outlineId); } catch { /* raw */ }
    return <PptOutlinePicker outlineId={outlineId} />;
  }
  const pptMatch = currentPath.match(/^\/ppt\/([^/]+)$/);
  if (pptMatch) {
    let pptId = pptMatch[1];
    try { pptId = decodeURIComponent(pptId); } catch { /* pass raw */ }
    return <PptPage pptId={pptId} />;
  }

  return (
    <div className="workbuddy-app">
      <WorkBuddySidebar active="home" projectCount={projects.length} workspaceCount={workspaceCount} assetCount={assetCount} go={go} setNotice={setNotice} />

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
                placeholder={t("home.composer.ph")}
                rows={3}
                ariaLabel={t("home.composer.aria")}
                autoResize
              />
              <div className="composer-intent-row">
                <label className="composer-mode" title={modeLocked ? "已手动指定；清空输入框可恢复自动识别" : "根据你的描述自动判断"}>
                  {modeLocked ? "任务类型" : "自动识别"}
                  <select
                    aria-label="任务模式"
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value as WorkMode);
                      setModeLocked(true);
                    }}
                  >
                    {MODE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id} title={option.hint}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {deliverable && (
                  <span className="composer-intent" role="status" aria-live="polite">
                    <HomeIcon name={deliverable.icon} size={13} />
                    {deliverable.label}
                  </span>
                )}
              </div>
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
                  expertPanel={(onManual, onClose) => <ExpertMatchPanel match={expertMatch} onManual={onManual} onClose={onClose} onSelect={name => {
                    onClose(); setSelectedExpert(name); setNotice("");
                    requestAnimationFrame(() => composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }));
                  }} onConfigure={() => { onClose(); openSettings("models"); }} onViewDetails={expertMatch.profile && expertMatch.profile.id !== "manual" ? () => { onClose(); go(`/experts/${encodeURIComponent(expertMatch.profile!.id)}`); } : undefined} />}
                  selectedSkill={selectedSkill}
                  onOpen={() => setModelMenuOpen(false)}
                  onUpload={() => fileInputRef.current?.click()}
                  onStartFileTask={() => startProject(prompt.trim(), undefined, "skills")}
                  onModeChange={(next) => { setMode(next); setModeLocked(true); }}
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
                  <button className={isPptPrompt(prompt) ? "send-button is-ppt" : "send-button"} disabled={busy || !prompt.trim()} title={isPptPrompt(prompt) ? "一键生成 PPTX" : t("home.send")} aria-label={isPptPrompt(prompt) ? "生成演示文稿" : t("home.send")} onClick={() => startProject()}>
                    {busy ? "…" : isPptPrompt(prompt) ? <>生成 PPT</> : <HomeIcon name="send" size={19} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="composer-footer">
              <button
                type="button"
                className="composer-settings-toggle"
                aria-expanded={settingsOpen}
                aria-label="更多设置"
                title="工作空间与执行权限"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <HomeIcon name="settings" size={12} /> 更多设置
              </button>
              <span className="composer-hint">
                <kbd>⌘K</kbd> 找场景、技能与插件
              </span>
              {settingsOpen && (
                <div className="composer-settings" role="group" aria-label="工作空间与执行权限">
                  <label className="footer-select">
                    <HomeIcon name="folder" />
                    <select value={workspace} onChange={(event) => setWorkspace(event.target.value)} aria-label={t("home.workspace.aria")}>
                      <option value="默认工作空间">{t("home.workspace.default")}</option>
                      <option value="个人空间">{t("home.workspace.personal")}</option>
                      <option value="产品设计空间">{t("home.workspace.design")}</option>
                      {!["默认工作空间", "个人空间", "产品设计空间"].includes(workspace) && (
                        <option value={workspace}>{workspace}</option>
                      )}
                    </select>
                    <HomeIcon name="chevron" size={10} />
                  </label>
                  <label className="footer-select">
                    <HomeIcon name="shield" />
                    <select style={{ width: `calc(${Math.max(t("home.permission.default").length, t("home.permission.local").length, t("home.permission.confirm").length, permission.length)}em + 4px)` }} value={permission} onChange={(event) => setPermission(event.target.value)} aria-label={t("home.permission.aria")}>
                      <option value="默认权限">{t("home.permission.default")}</option>
                      <option value="仅本地">{t("home.permission.local")}</option>
                      <option value="需要确认后执行">{t("home.permission.confirm")}</option>
                      {!["默认权限", "仅本地", "需要确认后执行"].includes(permission) && (
                        <option value={permission}>{permission}</option>
                      )}
                    </select>
                    <HomeIcon name="chevron" size={10} />
                  </label>
                </div>
              )}
            </div>
          </section>

          {notice && (
            <div className="home-notice" role="status">
              <span aria-hidden="true">ⓘ</span>
              <span>{notice}</span>
              <button aria-label={t("home.notice.close")} onClick={() => setNotice("")}>×</button>
            </div>
          )}

          <p className="home-launcher-hint">点一个示例会填入完整提示词，不会直接发送。</p>

          <HomeSuggestionBar mode={mode} prompt={prompt} onSelect={selectHomeScene} />

          <HomeRecent
            items={recentItems}
            onOpen={(item) => go(item.kind === "deck" ? `/ppt/${encodeURIComponent(item.id)}` : projectTaskPath(item.id))}
            onAll={() => go("/projects")}
          />
        </div>
      </main>
      <HomeCommandPalette
        open={paletteOpen}
        mode={mode}
        onClose={() => setPaletteOpen(false)}
        onSelectScene={(scene) => { setPaletteOpen(false); selectHomeScene(scene); }}
        onPreviewScene={(scene) => setPreviewScene(scene)}
        onSelectSkill={(name) => {
          setPaletteOpen(false);
          setSelectedSkill(name);
          setNotice(`已选择技能「${name}」，补充需求后发送；执行前的权限会再次确认。`);
          requestAnimationFrame(() => composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }));
        }}
        onNavigate={go}
      />
    </div>
  );
}
