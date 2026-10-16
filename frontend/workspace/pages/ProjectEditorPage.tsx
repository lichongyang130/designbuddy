import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DesignProject, ProjectFile } from "../models/project";
import { getProject, updateProject } from "../projectStore";
import { navigateTo } from "../workspaceRoutes";
import { generateProjectWithAI, runLocalCodingAgent, type LocalCodingAgent } from "../api/generation";
import { getCloudProject, saveProjectToCloud } from "../api/projects";
import { downloadProjectZip } from "../utils/zip";
import { applyDesignSystemTokens, createDesignContract, designSystems } from "../utils/designSystem";
import { AIChatPanel, type ChatMessage } from "../AIChatPanel";
import { CodePreview } from "../CodePreview";
import { FileExplorer } from "../FileExplorer";
import { GenerationTimeline, type GenerationStep } from "../GenerationTimeline";
import { LivePreview } from "../LivePreview";
import { publishProjectEvent, subscribeToProject, type CollaborationEvent } from "../api/collaboration";
import { addProjectMember, listProjectMembers, removeProjectMember, type ProjectMember } from "../api/memberships";
import { AIProviderSettings, getAIProviderCredentials } from "../AIProviderSettings";

function buildPreviewDocument(files: ProjectFile[], inspect = true): string {
  const htmlFile = files.find((file) => file.path === "index.html");
  const css = files.find((file) => file.path === "src/styles.css")?.content ?? "";
  const js = files.find((file) => file.path === "src/main.js")?.content ?? "";
  let html = htmlFile?.content ?? "<!doctype html><html><body><h1>新建页面</h1></body></html>";
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  html = html.replace(/<link[^>]+href=["']\.\/src\/styles\.css["'][^>]*>/i, `<style>${safeCss}</style>`);
  html = html.replace(/<script[^>]+src=["']\.\/src\/main\.js["'][^>]*><\/script>/i, `<script>${safeJs}<\/script>`);
  const editorBridge = `<style>[data-db-selected]{outline:2px solid #7458ed!important;outline-offset:2px!important;cursor:crosshair!important}</style><script>(function(){let selected='';function path(el){const parts=[];while(el&&el!==document.body){let part=el.tagName.toLowerCase();if(el.id){part+='#'+CSS.escape(el.id);parts.unshift(part);break}const siblings=el.parentElement?[...el.parentElement.children].filter(x=>x.tagName===el.tagName):[];if(siblings.length>1)part+=':nth-of-type('+(siblings.indexOf(el)+1)+')';parts.unshift(part);el=el.parentElement}return parts.join(' > ')}document.addEventListener('click',function(e){const a=e.target.closest('a');if(a&&a.getAttribute('href')?.startsWith('#'))e.preventDefault();const el=e.target.closest('body *');if(!el)return;e.preventDefault();e.stopPropagation();selected=path(el);document.querySelectorAll('[data-db-selected]').forEach(x=>x.removeAttribute('data-db-selected'));el.setAttribute('data-db-selected','');parent.postMessage({type:'db-select',selector:selected,tag:el.tagName.toLowerCase(),text:(el.innerText||'').slice(0,100)},'*')},true);addEventListener('message',function(e){if(e.data?.type==='db-style'&&selected){const el=document.querySelector(selected);if(el)el.style.setProperty(e.data.property,e.data.value)}});})();<\/script>`;
  if (inspect) html = html.replace(/<\/body>/i, `${editorBridge}</body>`);
  return html;
}

export default function ProjectEditorPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<DesignProject | null>(() => getProject(projectId) ?? null);
  const [activePath, setActivePath] = useState("index.html");
  const [interactivePreview, setInteractivePreview] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [notice, setNotice] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [localAgent, setLocalAgent] = useState<LocalCodingAgent>("codex");
  const [localAgentPrompt, setLocalAgentPrompt] = useState("");
  const [generationStatus, setGenerationStatus] = useState<"idle" | "active" | "complete" | "error">("idle");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);
  const [cloudUpdateAvailable, setCloudUpdateAvailable] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ selector: string; tag: string; text: string } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewNotes, setReviewNotes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`designbuddy.review.${projectId}`) || "[]") as string[]; } catch { return []; }
  });
  const [sharedComment, setSharedComment] = useState("");
  const [sharedComments, setSharedComments] = useState<CollaborationEvent[]>([]);
  const [collaborationState, setCollaborationState] = useState("连接共享空间…");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<ProjectMember["role"]>("editor");

  useEffect(() => {
    setProject(getProject(projectId) ?? null);
    setActivePath("index.html");
    setNotice("");
    setChatMessages([]);
    setGenerationStatus("idle");
    try { setReviewNotes(JSON.parse(localStorage.getItem(`designbuddy.review.${projectId}`) || "[]") as string[]); } catch { setReviewNotes([]); }
  }, [projectId]);

  useEffect(() => { void listProjectMembers(projectId).then(setMembers); }, [projectId]);

  useEffect(() => {
    setSharedComments([]);
    const unsubscribe = subscribeToProject(projectId, (event) => {
      if (event.type === "presence.snapshot") {
        const ids = event.users.filter((user) => (user.payload as { online?: unknown })?.online !== false).map((user) => user.userId);
        setOnlineUsers(ids);
        setCollaborationState("已连接");
      } else if (event.type === "comment") {
        setSharedComments((current) => current.some((item) => item.id === event.id) ? current : [...current, event]);
      } else if (event.type === "presence") {
        const online = (event.payload as { online?: unknown })?.online !== false;
        setOnlineUsers((current) => {
          return online ? [...new Set([...current, event.userId])] : current.filter((id) => id !== event.userId);
        });
      } else if (event.type === "document") {
        setCloudUpdateAvailable(true);
        setNotice("团队成员已同步项目源码；为避免覆盖你的编辑，请先保存本地修改，再重新载入共享项目。");
      }
    }, () => setCollaborationState("协作服务不可用或无权访问"));
    return unsubscribe;
  }, [projectId]);

  useEffect(() => {
    const key = `designbuddy.generate-on-open.${projectId}`;
    const pending = window.sessionStorage.getItem(key);
    if (!pending) return;
    window.sessionStorage.removeItem(key);
    try {
      const task = JSON.parse(pending) as { prompt?: unknown; model?: unknown; localOnly?: unknown };
      if (task.localOnly === true || project?.executionPolicy === "仅本地") {
        setNotice("已按“仅本地”策略创建草稿，没有发送 AI 网络请求。可继续手动编辑源码。");
        return;
      }
      if (typeof task.prompt === "string" && task.prompt.trim()) {
        void runGeneration(task.prompt, typeof task.model === "string" ? task.model : undefined);
      }
    } catch {
      setNotice("自动生成任务读取失败；你可以在右侧 AI 设计助手中重新提交需求。");
    }
  }, [projectId]);

  const activeFile = project?.files.find((file) => file.path === activePath) ?? project?.files[0];
  const previewDocument = useMemo(() => buildPreviewDocument(project?.files ?? [], !interactivePreview), [project?.files, interactivePreview]);
  const generationSteps: GenerationStep[] = generationStatus === "idle" ? [] : [
    { id: "request", name: "提交需求", status: "complete" },
    { id: "generate", name: "生成页面源码", status: generationStatus === "active" ? "active" : generationStatus === "error" ? "error" : "complete" },
    { id: "save", name: "保存到本机项目", status: generationStatus === "complete" ? "complete" : "waiting" },
  ];

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== document.querySelector<HTMLIFrameElement>(".db-live-preview-stage iframe")?.contentWindow || event.data?.type !== "db-select") return;
      setSelectedElement({ selector: String(event.data.selector), tag: String(event.data.tag), text: String(event.data.text) });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!project) {
    return (
      <main className="db-not-found">
        <h1>没有找到这个项目</h1>
        <p>项目可能已删除，或保存在另一个浏览器中。</p>
        <button className="db-button db-button-primary" onClick={() => navigateTo("/projects")}>返回项目列表</button>
      </main>
    );
  }

  function changeFile(nextContent: string) {
    if (!project || !activeFile) return;
    const updated: DesignProject = {
      ...project,
      files: project.files.map((file) => file.path === activeFile.path ? { ...file, content: nextContent } : file),
      updatedAt: new Date().toISOString(),
    };
    try {
      const saved = updateProject(updated);
      setProject(saved);
      setSaveFailed(false);
      setCloudSaved(false);
      setNotice("");
    } catch (cause) {
      setSaveFailed(true);
      setNotice(cause instanceof Error ? cause.message : "保存失败。");
    }
  }

  function renameProject() {
    const current = project;
    if (!current) return;
    const nextName = window.prompt("项目名称", current.name);
    if (!nextName?.trim()) return;
    try {
      setProject(updateProject({ ...current, name: nextName.trim().slice(0, 80) }));
      setSaveFailed(false);
      setNotice("项目名称已更新。");
    } catch (cause) {
      setSaveFailed(true);
      setNotice(cause instanceof Error ? cause.message : "重命名失败。");
    }
  }

  async function copySource() {
    const current = project;
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.files.map((file) => `/* ${file.path} */\n${file.content}`).join("\n\n"));
      setNotice("项目源码已复制到剪贴板。");
    } catch {
      setNotice("浏览器未授予剪贴板权限，请在代码模式中手动复制。");
    }
  }

  async function shareProject() {
    if (!project) return;
    try {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(project))));
      const url = `${window.location.origin}${import.meta.env.BASE_URL}share#project=${encodeURIComponent(encoded)}`;
      if (url.length > 90_000) throw new Error("项目内容过大，无法生成分享链接；请先精简源码或使用 ZIP 导出。");
      await navigator.clipboard.writeText(url);
      setNotice("只读分享链接已复制。收件人可预览并导入为自己的本机副本。");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "复制分享链接失败，请检查浏览器剪贴板权限。");
    }
  }

  async function runGeneration(prompt: string, model?: string) {
    const current = getProject(projectId) ?? project;
    if (!prompt || generating || !current) return;
    if (current.executionPolicy === "仅本地") { setNotice("此项目设置为“仅本地”，AI 网络生成已禁用。请更改任务策略后重新创建项目。"); return; }
    setGenerating(true);
    setGenerationStatus("active");
    setNotice("正在根据你的需求生成页面，首稿会在完成后替换本机模板。");
    try {
      const selectedSystem = designSystems.find((system) => system.id === current.designSystemId);
      const result = await generateProjectWithAI({
        prompt,
        projectName: current.name,
        model,
        ...getAIProviderCredentials(),
        designContract: selectedSystem ? createDesignContract(selectedSystem) : undefined,
        currentFiles: current.files.map(({ path, content, language }) => ({ path, content, language: language === "html" || language === "css" || language === "javascript" ? language : undefined })),
      });
      const generatedFiles: ProjectFile[] = result.files.map((file) => ({
        path: file.path,
        content: file.content,
        language: file.language ?? (file.path.endsWith(".html") ? "html" : file.path.endsWith(".css") ? "css" : file.path.endsWith(".js") ? "javascript" : "text"),
      }));
      const existingDesignContract = current.files.find((file) => file.path === "DESIGN.md");
      if (existingDesignContract && !generatedFiles.some((file) => file.path === "DESIGN.md")) generatedFiles.push(existingDesignContract);
      const next: DesignProject = {
        ...current,
        name: result.name?.trim() || current.name,
        prompt: prompt,
        files: generatedFiles,
        updatedAt: new Date().toISOString(),
      };
      const saved = updateProject(next);
      setProject(saved);
      setSaveFailed(false);
      setCloudSaved(false);
      setGenerationStatus("complete");
      setChatMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "assistant", content: "源码已生成并保存到本机项目。请检查预览，确认后再同步云端。" }]);
      setNotice("AI 已返回源码并更新本机项目。请检查预览，确认后再同步云端。");
      setView("preview");
    } catch (cause) {
      const message = (cause instanceof Error ? cause.message : "AI 生成失败；") + " 本机草稿已保留，可稍后重试。";
      setGenerationStatus("error");
      setChatMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "assistant", content: message }]);
      setNotice(message);
    } finally {
      setGenerating(false);
    }
  }

  async function sendAssistantMessage(message: string) {
    setChatMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "user", content: message }]);
    await runGeneration(message);
  }

  async function runInstalledAgent() {
    const prompt = localAgentPrompt.trim() || [...chatMessages].reverse().find((message) => message.role === "user")?.content;
    if (!prompt?.trim() || generating) { setNotice("先在设计助手中写下一个任务，再交给本机 coding agent。"); return; }
    setGenerating(true); setGenerationStatus("active"); setNotice(`正在本机启动 ${localAgent}…`);
    try {
      const result = await runLocalCodingAgent(projectId, localAgent, prompt, project);
      const next: DesignProject = { ...project!, files: result.project.files.map((file) => ({ ...file, language: file.language ?? (file.path.endsWith(".html") ? "html" : file.path.endsWith(".css") ? "css" : file.path.endsWith(".js") ? "javascript" : "text") })), updatedAt: new Date().toISOString() };
      const saved = updateProject(next);
      setProject(saved); setGenerationStatus("complete"); setSaveFailed(false); setCloudSaved(false);
      setChatMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "assistant", content: `${localAgent} 已修改本地项目文件。\n\n${result.output}` }]);
      setNotice(`${localAgent} 已完成修改，结果已保存到本机项目。`);
    } catch (error) {
      setGenerationStatus("error"); setNotice(error instanceof Error ? error.message : "本机 coding agent 执行失败。");
    } finally { setGenerating(false); }
  }

  async function syncToCloud() {
    const current = project;
    if (cloudBusy || !current) return;
    setCloudBusy(true);
    setNotice("");
    try {
      await saveProjectToCloud(current);
      setCloudSaved(true);
      setNotice("云端服务已确认保存该项目。");
    } catch (cause) {
      setCloudSaved(false);
      setNotice(cause instanceof Error ? cause.message : "云端同步失败。");
    } finally {
      setCloudBusy(false);
    }
  }

  async function reloadCloudProject() {
    try {
      const remote = await getCloudProject(projectId);
      const saved = updateProject({ ...remote, files: remote.files.map((file) => ({ ...file, language: file.language ?? (file.path.endsWith(".html") ? "html" : file.path.endsWith(".css") ? "css" : file.path.endsWith(".js") ? "javascript" : "text") })) });
      setProject(saved); setCloudSaved(true); setCloudUpdateAvailable(false); setSaveFailed(false);
      setNotice("已载入团队成员同步的最新源码。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "重新载入共享项目失败。"); }
  }

  function downloadZip() {
    const current = project;
    if (!current) return;
    try {
      downloadProjectZip(current.name, current.files.map(({ path, content }) => ({ path, content })));
      setNotice("项目 ZIP 已开始下载。");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "ZIP 导出失败。");
    }
  }

  function applyDesignSystem(system: typeof designSystems[number]) {
    const current = project;
    if (!current) return;
    let saved: DesignProject;
    try { saved = updateProject(applyDesignSystemTokens(current, system)); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "无法应用这个设计系统。"); return; }
    setProject(saved); setNotice(`已应用“${system.name}”设计系统。`);
  }

  function applyElementStyle(property: "color" | "background-color" | "font-size" | "padding", value: string) {
    const current = project;
    if (!selectedElement || !current) return;
    const frame = document.querySelector<HTMLIFrameElement>(".db-live-preview-stage iframe");
    frame?.contentWindow?.postMessage({ type: "db-style", property, value }, "*");
    const cssFile = current.files.find((file) => file.path === "src/styles.css");
    if (!cssFile) return;
    const marker = `/* Visual edit: ${selectedElement.selector} */`;
    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\[\]\\]/g, "\\$&");
    const existing = new RegExp(`${escapeRegex(marker)}\\s*\\{[^}]*\\}`, "g");
    const rule = `${marker}\n${selectedElement.selector} { ${property}: ${value} !important; }`;
    const content = existing.test(cssFile.content) ? cssFile.content.replace(existing, rule) : `${cssFile.content}\n\n${rule}\n`;
    const saved = updateProject({ ...current, files: current.files.map((file) => file.path === cssFile.path ? { ...file, content } : file), updatedAt: new Date().toISOString() });
    setProject(saved);
  }

  function exportStandaloneHtml() {
    const current = project;
    if (!current) return;
    const html = buildPreviewDocument(current.files);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${current.name}.html`; link.click(); URL.revokeObjectURL(url);
    setNotice("独立 HTML 已导出。");
  }

  function exportPdf() {
    const current = project;
    if (!current) return;
    const preview = window.open("", "_blank");
    if (!preview) { setNotice("浏览器阻止了弹出窗口，请允许此站点打开窗口后重试。"); return; }
    preview.document.open(); preview.document.write(buildPreviewDocument(current.files)); preview.document.close();
    preview.onload = () => preview.print();
  }

  function addReviewNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const value = reviewNote.trim(); if (!value) return;
    const current = project; if (!current) return;
    const next = [...reviewNotes, value]; setReviewNotes(next); setReviewNote("");
    localStorage.setItem(`designbuddy.review.${current.id}`, JSON.stringify(next));
  }

  async function addSharedComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = sharedComment.trim();
    if (!content) return;
    try {
      const created = await publishProjectEvent(projectId, "comment", { content });
      setSharedComments((current) => current.some((item) => item.id === created.id) ? current : [...current, created]);
      setSharedComment("");
      setCollaborationState("已连接");
    } catch (error) { setCollaborationState(error instanceof Error ? error.message : "共享评论发送失败"); }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const added = await addProjectMember(projectId, memberUserId.trim(), memberRole);
      setMembers((current) => [...current.filter((member) => member.userId !== added.userId), added]);
      setMemberUserId("");
    } catch (error) { setCollaborationState(error instanceof Error ? error.message : "添加成员失败"); }
  }

  async function revokeMember(userId: string) {
    try { await removeProjectMember(projectId, userId); setMembers((current) => current.filter((member) => member.userId !== userId)); }
    catch (error) { setCollaborationState(error instanceof Error ? error.message : "移除成员失败"); }
  }

  return (
    <main className="db-editor-page">
      <header className="db-editor-header">
        <button className="db-back-button" onClick={() => navigateTo("/projects")} aria-label="返回项目列表">← <span>项目</span></button>
        <div className="db-editor-project-name">
          <strong>{project.name}</strong>
          <button onClick={renameProject} aria-label="重命名项目">✎</button>
          <span className={saveFailed ? "db-save-state is-error" : "db-save-state"}><i />{saveFailed ? "保存失败" : cloudSaved ? "云端已同步" : "已保存在本机"}</span>
        </div>
        <div className="db-editor-header-actions">
          <button className={view === "code" ? "db-button db-button-secondary is-selected" : "db-button db-button-secondary"} onClick={() => setView("code")}>{"</>"} 代码</button>
          <button className={view === "preview" ? "db-button db-button-secondary is-selected" : "db-button db-button-secondary"} onClick={() => setView("preview")}>◫ 预览</button>
          <button className="db-button db-button-secondary" onClick={downloadZip}>下载 ZIP</button>
          <button className="db-button db-button-secondary" onClick={() => void shareProject()}>分享只读副本</button>
          <button className="db-button db-button-secondary" onClick={() => void syncToCloud()} disabled={cloudBusy}>{cloudBusy ? "同步中…" : "同步云端"}</button>
          {cloudUpdateAvailable && <button className="db-button db-button-secondary" onClick={() => void reloadCloudProject()}>载入团队最新版本</button>}
          <button className="db-button db-button-primary" onClick={() => void copySource()}>复制源码 <span>↗</span></button>
        </div>
      </header>

      <div className="db-editor-layout">
        <aside className="db-file-sidebar">
          <div className="db-panel-heading"><span>项目文件</span><span>{project.files.length}</span></div>
          <div className="db-file-list">
            <FileExplorer files={project.files} selectedPath={activePath} onSelect={setActivePath} />
          </div>
          <div className="db-file-sidebar-note">
            <strong>需求描述</strong>
            <p>{project.prompt || "尚未填写需求描述。"}</p>
          </div>
        </aside>

        <section className="db-editor-main">
          <div className="db-canvas-toolbar">
            <div className="db-canvas-tabs">
              <button className={view === "preview" ? "is-active" : ""} onClick={() => setView("preview")}>设计预览</button>
              <button className={view === "code" ? "is-active" : ""} onClick={() => setView("code")}>源代码</button>
            </div>
            {view === "preview" && (
              <div className="db-device-picker" aria-label="预览设备">
                <button style={{ width: "auto", padding: "0 9px" }} aria-label="交互模式" aria-pressed={interactivePreview} title="切换页面交互与元素选择；切换会重新加载预览" className={interactivePreview ? "is-active" : ""} onClick={() => { setInteractivePreview(value => !value); setSelectedElement(null); }}>交互模式</button>
                <button title="桌面" aria-label="桌面预览" className={device === "desktop" ? "is-active" : ""} onClick={() => setDevice("desktop")}>▰</button>
                <button title="平板" aria-label="平板预览" className={device === "tablet" ? "is-active" : ""} onClick={() => setDevice("tablet")}>▯</button>
                <button title="手机" aria-label="手机预览" className={device === "mobile" ? "is-active" : ""} onClick={() => setDevice("mobile")}>▏</button>
              </div>
            )}
            <div className="db-design-tools"><select aria-label="设计系统" value={project.designSystemId ?? ""} onChange={(event) => { const system = designSystems.find((item) => item.id === event.target.value); if (system) applyDesignSystem(system); }}><option value="">选择设计系统 · {designSystems.length} 套</option>{designSystems.map((system) => <option value={system.id} key={system.id}>{system.name} · {system.category}</option>)}</select><button onClick={exportStandaloneHtml}>导出 HTML</button><button onClick={exportPdf}>导出 PDF</button></div>
          </div>
          {view === "preview" ? (
            <div className="db-live-preview-stage">
              <div className={`db-preview-frame db-preview-${device}`}>
                <LivePreview title={`${project.name} 实时预览`} srcDoc={previewDocument} />
              </div>
              <p className="db-preview-caption">沙盒预览 · 不会访问项目之外的本机文件</p>
              {selectedElement && <div className="db-element-inspector"><strong>元素样式 · &lt;{selectedElement.tag}&gt;</strong><span title={selectedElement.text}>{selectedElement.text || selectedElement.selector}</span><label>文字颜色<input type="color" onChange={(e) => applyElementStyle("color", e.target.value)} /></label><label>背景颜色<input type="color" onChange={(e) => applyElementStyle("background-color", e.target.value)} /></label><label>字号<input type="range" min="10" max="72" defaultValue="16" onChange={(e) => applyElementStyle("font-size", `${e.target.value}px`)} /></label><label>内边距<input type="range" min="0" max="64" defaultValue="0" onChange={(e) => applyElementStyle("padding", `${e.target.value}px`)} /></label><button onClick={() => setSelectedElement(null)}>关闭</button></div>}
            </div>
          ) : (
            <div className="db-code-editor">
              <CodePreview path={activeFile?.path ?? "index.html"} language={activeFile?.language ?? "text"} code={activeFile?.content ?? ""} onChange={changeFile} />
              <p className="db-code-hint">源文件修改后会自动保存在本机，切换到“设计预览”查看结果。</p>
            </div>
          )}
          {notice && <p className="db-editor-notice" role="status">{notice}</p>}
        </section>

        <aside className="db-assistant-sidebar">
          <div className="db-panel-heading"><span>AI 设计助手</span><span className="db-beta">预览版</span></div>
          <div className="db-assistant-intro">
            <div className="db-assistant-avatar">✳</div>
            <h2>继续打磨你的想法</h2>
            <p>描述要调整的布局、配色或内容。AI 返回的源码会先保存在本机，确认预览后再同步到云端。</p>
          </div>
          <div className="db-assistant-status"><i /> 当前项目为本机草稿模式</div>
          <AIProviderSettings />
          <div className="db-agent-cli-row"><label>本机 coding agent<select value={localAgent} onChange={(event) => setLocalAgent(event.target.value as LocalCodingAgent)}><option value="codex">Codex CLI</option><option value="claude">Claude Code</option><option value="opencode">OpenCode</option><option value="gemini">Gemini CLI</option><option value="cursor-agent">Cursor Agent</option></select></label><textarea aria-label="本机 agent 任务" rows={2} value={localAgentPrompt} onChange={(event) => setLocalAgentPrompt(event.target.value)} placeholder="本机执行任务；留空时复用最近一条聊天需求"/><button disabled={generating || (!localAgentPrompt.trim() && !chatMessages.some((message) => message.role === "user"))} onClick={() => void runInstalledAgent()}>交给本机 agent 修改</button></div>
          <GenerationTimeline steps={generationSteps} />
          <AIChatPanel messages={chatMessages} onSend={sendAssistantMessage} busy={generating} disabled={project.executionPolicy === "仅本地"} placeholder="例如：把页面改成深色风格，并加入价格方案…" />
          <div className="db-assistant-footnote">AI 生成需要配置服务端 API 密钥；云端同步需要已登录的 API 服务。失败时会显示具体原因，不会覆盖当前项目。</div>
          <section className="db-review-panel"><h3>本机评审备注</h3><form onSubmit={addReviewNote}><textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={2} placeholder="记录自己的修改意见或待办…"/><button disabled={!reviewNote.trim()}>添加备注</button></form><ul>{reviewNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul></section>
          <section className="db-review-panel"><h3>团队评论 <small>{onlineUsers.length} 人在线</small></h3><p role="status">{collaborationState}</p><form onSubmit={(event) => void addSharedComment(event)}><textarea value={sharedComment} onChange={(event) => setSharedComment(event.target.value)} rows={2} maxLength={2000} placeholder="给团队留下共享反馈…"/><button disabled={!sharedComment.trim()}>发送评论</button></form><ul>{sharedComments.map((item) => <li key={item.id}><strong>{item.userId}</strong>：{String((item.payload as { content?: unknown })?.content ?? "")}</li>)}</ul></section>
          <section className="db-review-panel"><h3>项目成员</h3><form onSubmit={(event) => void inviteMember(event)}><input aria-label="成员用户 ID" value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} placeholder="输入团队成员 user ID"/><select aria-label="成员权限" value={memberRole} onChange={(event) => setMemberRole(event.target.value as ProjectMember["role"])}><option value="editor">可编辑</option><option value="viewer">只读</option></select><button disabled={!memberUserId.trim()}>添加成员</button></form><ul>{members.map((member) => <li key={member.userId}><span>{member.userId} · {member.role === "editor" ? "可编辑" : "只读"}</span><button onClick={() => void revokeMember(member.userId)}>移除</button></li>)}</ul></section>
        </aside>
      </div>
    </main>
  );
}
