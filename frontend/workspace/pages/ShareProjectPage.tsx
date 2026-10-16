import { useMemo, useState } from "react";
import type { DesignProject, ProjectFile } from "../models/project";
import { navigateTo } from "../workspaceRoutes";
import { createProject, updateProject } from "../projectStore";

const maxShareBytes = 1_000_000;

function readSharedProject(): DesignProject | null {
  try {
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get("project");
    if (!encoded || encoded.length > maxShareBytes) return null;
    const decoded = decodeURIComponent(escape(atob(encoded)));
    const value = JSON.parse(decoded) as Partial<DesignProject>;
    if (typeof value.name !== "string" || typeof value.prompt !== "string" || !Array.isArray(value.files) || value.files.length > 20) return null;
    const files: ProjectFile[] = value.files.map((file) => {
      if (!file || typeof file.path !== "string" || typeof file.content !== "string" || file.content.length > 250_000) throw new Error("invalid");
      if (file.path.startsWith("/") || file.path.replace(/\\/g, "/").split("/").includes("..")) throw new Error("invalid");
      return { path: file.path, content: file.content, language: file.language === "html" || file.language === "css" || file.language === "javascript" || file.language === "json" ? file.language : "text" };
    });
    if (!files.some((file) => file.path === "index.html")) return null;
    return { id: "shared", name: value.name.slice(0, 80), prompt: value.prompt.slice(0, 12_000), files, createdAt: "", updatedAt: "", status: "draft", designSystemId: value.designSystemId };
  } catch { return null; }
}

function makeReadOnlyPreview(project: DesignProject): string {
  const htmlFile = project.files.find((file) => file.path === "index.html");
  const css = project.files.find((file) => file.path === "src/styles.css")?.content ?? "";
  const html = (htmlFile?.content ?? "").replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "").replace(/<link\b[^>]*>/gi, "");
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:;">`;
  return html.replace(/<head([^>]*)>/i, `<head$1>${policy}<style>${css.replace(/<\/style/gi, "")}</style>`);
}

export default function ShareProjectPage() {
  const [notice, setNotice] = useState("");
  const project = useMemo(readSharedProject, []);
  const preview = useMemo(() => project ? makeReadOnlyPreview(project) : "", [project]);

  function importProject() {
    if (!project) return;
    try {
      const draft = createProject(project.prompt, project.name);
      const saved = updateProject({ ...draft, files: project.files, designSystemId: project.designSystemId, updatedAt: new Date().toISOString() });
      navigateTo(`/editor/${encodeURIComponent(saved.id)}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "无法导入分享项目。"); }
  }

  return <main className="db-share-page">
    <header><button onClick={() => navigateTo("/")}>← 返回工作台</button><strong>DesignBuddy · 项目分享</strong><button disabled={!project} onClick={importProject}>保存到本机并编辑</button></header>
    {project ? <><section className="db-share-summary"><span>只读分享预览</span><h1>{project.name}</h1><p>{project.prompt}</p><small>此链接携带项目源文件。保存后会在你的浏览器中创建独立副本。</small></section><div className="db-share-frame"><iframe title={`${project.name} 分享预览`} sandbox="" srcDoc={preview} /></div></> : <section className="db-share-invalid"><h1>分享链接无效或已损坏</h1><p>请让分享者重新复制项目分享链接。</p><button onClick={() => navigateTo("/")}>返回工作台</button></section>}
    {notice && <p role="alert">{notice}</p>}
  </main>;
}
