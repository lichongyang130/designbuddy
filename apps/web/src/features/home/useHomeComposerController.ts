import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DesignProject } from "../../../../../frontend/workspace/models/project";
import { createProject, listProjects, updateProject } from "../../../../../frontend/workspace/projectStore";
import { navigateTo, normalizeAppPath } from "../../../../../frontend/workspace/workspaceRoutes";
import { isPptPrompt, listPptProjects } from "../../../../../frontend/workspace/pptStore";
import { listAssets } from "../../../../../frontend/workspace/api/assets";
import { fetchAccount, type AccountIdentity } from "../../../../../frontend/workspace/api/account";
import {
  saveTaskConversation,
  pendingTaskKey,
  type TaskConversation,
} from "../../../../../frontend/workspace/taskConversation";
import {
  matchBinding,
  openSettings,
  setComposerDefaults,
  syncPreferencesFromAccount,
  useModelOptions,
  usePreferences,
  useSettingsWindow,
} from "../../../../../frontend/workspace/settingsStore";
import { listWorkspaces, workspaceRoleLabel, type Workspace } from "../../../../../frontend/workspace/api/workspaces";
import { AUTH_GATE_ENABLED } from "../../../../../frontend/workspace/authGate";
import { useExpertMatch } from "../../components/useExpertMatch";
import { selectionGate, useSkillSelection } from "../../components/useRuntimeSkill";
import { modeLabels, type HomeScene } from "../../components/homeScenes";
import type { SpaceOption } from "../../components/HomeWorkspacePicker";
import type { RecentItem } from "../../components/HomeSuggestionBar";
import type { TaskAttachment, WorkMode } from "./HomeComposerSection";

const textAttachmentExtensions = /\.(txt|md|markdown|json|html|htm|css|js|csv|xml|yaml|yml)$/i;

export const PERMISSION_HINTS: Record<string, string> = {
  默认权限: "按账号设置执行",
  仅本地: "不发送任何 AI 请求，只存在本机",
  需要确认后执行: "发送前再问你一次",
};

export function useHomeComposerController() {
  const modelOptions = useModelOptions();
  const defaultModel = usePreferences((state) => state.defaultModel);
  const defaultMode = usePreferences((state) => state.defaultMode);
  const defaultWorkspace = usePreferences((state) => state.defaultWorkspace);
  const defaultPermission = usePreferences((state) => state.defaultPermission);

  const [currentPath, setCurrentPath] = useState(normalizeAppPath(window.location.pathname));
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<WorkMode>(() => usePreferences.getState().defaultMode || "office");
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
  const [teamSpaces, setTeamSpaces] = useState<Workspace[]>([]);
  const [permission, setPermission] = useState(() => usePreferences.getState().defaultPermission || "默认权限");
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [selectedExpert, setSelectedExpert] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [previewScene, setPreviewScene] = useState<HomeScene | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const startProjectRef = useRef<() => void>(() => {});

  const expertMatch = useExpertMatch({
    prompt,
    mode,
    model,
    permission,
    attachments,
    selectedExpert,
    enabled: currentPath === "/",
  });
  const skillSelection = useSkillSelection(selectedSkill);

  useEffect(() => {
    void syncPreferencesFromAccount();
  }, []);

  useEffect(() => setMode(defaultMode || "office"), [defaultMode]);
  useEffect(() => setModel(defaultModel || "agnes-3.0-flash"), [defaultModel]);
  useEffect(() => setWorkspace(defaultWorkspace || "默认工作空间"), [defaultWorkspace]);
  useEffect(() => setPermission(defaultPermission || "默认权限"), [defaultPermission]);

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

  function go(path: string) {
    navigateTo(path);
    setCurrentPath(normalizeAppPath(window.location.pathname));
    setProjects(listProjects());
    setNotice("");
  }

  useEffect(() => {
    if (!AUTH_GATE_ENABLED && (currentPath === "/login" || currentPath === "/register" || currentPath === "/auth")) {
      go("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  useEffect(() => {
    const dispatch = (event: KeyboardEvent) => {
      const bindings = usePreferences.getState().keybindings;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        if (currentPath !== "/") return;
        event.preventDefault();
        setPaletteOpen(true);
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

  const publicRoute =
    currentPath === "/login" ||
    currentPath === "/register" ||
    currentPath === "/auth" ||
    currentPath.startsWith("/share");

  useEffect(() => {
    if (publicRoute) return;
    let cancelled = false;
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
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, publicRoute, identityAttempt]);

  useEffect(() => {
    let cancelled = false;
    void listWorkspaces()
      .then((list) => {
        if (cancelled) return;
        setWorkspaceCount(list.length);
        setTeamSpaces(list);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspaceCount(0);
        setTeamSpaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listAssets().catch(() => []), fetchAccount().catch(() => null)])
      .then(([assets, currentUser]) => {
        if (cancelled) return;
        setAssetCount(currentUser ? assets.filter((asset) => asset.ownerId === currentUser.id).length : assets.length);
      })
      .catch(() => {
        if (!cancelled) setAssetCount(0);
      });
    return () => {
      cancelled = true;
    };
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
    window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    try {
      const context = JSON.parse(raw) as { expert?: unknown; skill?: unknown; prompt?: unknown; mode?: unknown };
      if (typeof context.prompt === "string") {
        if (
          prompt.trim() &&
          prompt !== context.prompt &&
          !window.confirm("输入框已有内容，是否替换为此专家任务示例？附件、模型、工作空间和权限将保留。")
        ) {
          setNotice("已保留原始需求，未更换专家或填入任务示例。");
          return;
        }
        setPrompt(context.prompt);
        if (["office", "design", "code"].includes(String(context.mode))) setMode(context.mode as WorkMode);
        requestAnimationFrame(() => composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }));
      }
      if (typeof context.expert === "string") setSelectedExpert(context.expert);
      if (typeof context.skill === "string") setSelectedSkill(context.skill);
      setNotice(
        typeof context.prompt === "string"
          ? "已填入完整任务示例并锁定专家，尚未发送."
          : "已载入所选专家/技能，原有输入与设置已保留。",
      );
    } catch {
      setNotice("无法读取所选专家或技能，请重新选择。");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [modelMenuOpen]);

  useEffect(() => {
    if (!modelOptions.some((option) => option.id === model)) {
      setModel(modelOptions.find((option) => option.id === "agnes-3.0-flash")?.id ?? modelOptions[0]?.id ?? "");
    }
  }, [modelOptions, model]);

  const workspaceRoleValue = (name: string) => teamSpaces.find((item) => item.name === name)?.role;
  const workspaceOptions: SpaceOption[] = [
    { value: "默认工作空间", label: "默认工作空间", meta: "不指定团队" },
    { value: "个人空间", label: "个人空间", meta: "只有你能看到" },
    ...teamSpaces.map((item) => ({
      value: item.name,
      label: item.name,
      meta: item.role ? workspaceRoleLabel(item.role) : undefined,
    })),
  ];
  if (!workspaceOptions.some((option) => option.value === workspace)) {
    workspaceOptions.push({
      value: workspace,
      label: workspace,
      meta: workspaceRoleValue(workspace) ? workspaceRoleLabel(workspaceRoleValue(workspace)) : undefined,
    });
  }
  const workspaceDisplay = workspace === "默认工作空间" ? "选择工作空间" : workspace;
  const workspaceStorageHint =
    workspace === "默认工作空间"
      ? "未指定团队空间：任务保存在本机项目里"
      : workspace === "个人空间"
        ? "个人空间：任务保存在本机，不同步给团队"
        : `团队空间「${workspace}」：任务与项目归入该空间`;

  function pickWorkspace(next: string) {
    setWorkspace(next);
    setComposerDefaults({ defaultWorkspace: next === "默认工作空间" ? "" : next });
    const role = workspaceRoleValue(next);
    setNotice(
      next === "默认工作空间"
        ? "未指定团队空间：任务只保存在你的本机项目里。"
        : next === "个人空间"
          ? "已选个人空间：任务只保存在本机，不会同步给团队成员。"
          : `已选团队空间「${next}」${role ? `（${workspaceRoleLabel(role)}）` : ""}：这条任务与项目会归入该空间。`,
    );
  }

  async function openLocalFolder(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const readable = list
      .filter((file) => (textAttachmentExtensions.test(file.name) || file.type.startsWith("text/")) && file.size <= 160_000)
      .slice(0, 6);
    const parsed: TaskAttachment[] = [];
    for (const file of readable) {
      try {
        parsed.push({ name: file.name, text: (await file.text()).slice(0, 20_000) });
      } catch {
        parsed.push({ name: file.name });
      }
    }
    if (!parsed.length) {
      setNotice(`文件夹「${list[0].webkitRelativePath?.split("/")[0] ?? "所选文件夹"}」里没有可读取的文本文件（支持 txt / md / csv / json 等，单个 ≤160 KB）。`);
      return;
    }
    setAttachments((current) => [...current, ...parsed].slice(-4));
    setNotice(`已从本地文件夹读取 ${parsed.length} 个文本文件作为附件；内容只在本机解析，发送时才随任务一起提交。`);
    requestAnimationFrame(() => composerRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true }));
  }

  function pickPermission(next: string) {
    setPermission(next);
    setComposerDefaults({ defaultPermission: next === "默认权限" ? "" : next });
    setNotice(
      next === "仅本地"
        ? "已设为仅本地：这条任务不会发送给任何 AI 服务，只保存问题和你的记录。"
        : next === "需要确认后执行"
          ? "已设为需要确认后执行：每次真正发送前都会再问你一次。"
          : "已恢复默认权限：按账号与服务配置执行。",
    );
  }

  function selectHomeScene(scene: Pick<HomeScene, "mode" | "prompt">) {
    if (prompt.trim() && prompt !== scene.prompt && !window.confirm("输入框已有内容，是否替换为此场景的任务提示？附件、模型、工作空间和权限将保留。")) {
      return false;
    }
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

  function startPptProject(rawPrompt: string) {
    const promptText = rawPrompt.trim();
    if (!promptText) {
      setNotice("请输入演示主题，例如：Q4 季度复盘 · 运营策略");
      return;
    }
    try {
      setBusy(true);
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
    if (isPptPrompt(initialPrompt)) {
      return startPptProject(initialPrompt);
    }
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
      const hasModePrefix = [...Object.values(modeLabels), "日常办公", "代码开发", "设计创意"].some((label) =>
        initialPrompt.startsWith(`${label}需求：`),
      );
      const task = hasModePrefix ? `${expertPrefix}${skillPrefix}${initialPrompt}` : `${prefix}${expertPrefix}${skillPrefix}${initialPrompt}`;
      const request = `工作空间：${workspace}；执行策略：${permission}。\n${task}`;
      const attachmentContext = attachments
        .filter((item) => item.text || item.assetId)
        .map((item) => `\n\n--- 附件：${item.name}${item.assetId ? `（服务器素材 ${item.assetId}）` : ""} ---\n${item.text ?? ""}`)
        .join("");
      const fullRequest = request + confirmedContext + attachmentContext;
      const draft = createProject(fullRequest, projectName || initialPrompt.trim().slice(0, 36));
      const project = updateProject({ ...draft, workspaceName: workspace, executionPolicy: permission });
      const conversation: TaskConversation = {
        projectId: project.id,
        mode,
        model,
        permission,
        workflow,
        skillExpertId: (selectedExpert || sameDraft) ? expertMatch.profile?.id : undefined,
        suggestedSkillId: expertMatch.skillSuggestion?.skillId,
        // Carry the skill the composer chip is showing: it resolved against the
        // runtime catalogue, so the workbench can open on a real executor and
        // not on "let the model suggest one".
        selectedSkillId: skillSelection.skill?.id,
        messages: [
          {
            id: crypto.randomUUID(),
            role: "user",
            content: initialPrompt.trim(),
            requestContent: fullRequest,
            replyMode: (selectedExpert || sameDraft) ? expertMatch.replyMode : undefined,
            requirementsConfirmed: !!confirmedContext,
            createdAt: new Date().toISOString(),
            status: "complete",
          },
        ],
      };
      saveTaskConversation(conversation);
      try {
        if (workflow !== "skills") sessionStorage.setItem(pendingTaskKey(project.id), "1");
      } catch {
        conversation.messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          status: "error",
          error: "浏览器不允许自动提交，请点击重新生成。",
        });
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

  return {
    currentPath,
    publicRoute,
    identity,
    identityFailed,
    retryIdentity: () => setIdentityAttempt((attempt) => attempt + 1),
    projects,
    workspaceCount,
    assetCount,
    busy,
    go,
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
    workspace,
    workspaceDisplay,
    workspaceStorageHint,
    workspaceOptions,
    pickWorkspace,
    permission,
    pickPermission,
    openLocalFolder,
    startProject,
    selectHomeScene,
    recentItems,
    paletteOpen,
    setPaletteOpen,
    previewScene,
    setPreviewScene,
  };
}
