import { useMemo, useState } from "react";
import type { DesignProject } from "../models/project";
import { createProject, listProjects, removeProject, updateProject } from "../projectStore";
import { listCloudProjects } from "../api/projects";
import { projectTaskPath, loadTaskConversation } from "../taskConversation";
import { navigateTo } from "../workspaceRoutes";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚更新";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<DesignProject[]>(() => listProjects());
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [loadingCloud, setLoadingCloud] = useState(false);

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? projects.filter((project) =>
      project.name.toLocaleLowerCase().includes(needle) || project.prompt.toLocaleLowerCase().includes(needle)
    ) : projects;
  }, [projects, query]);

  function newProject() {
    try {
      const project = createProject("", "未命名设计项目");
      setProjects(listProjects());
      navigateTo(projectTaskPath(project.id));
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "创建项目失败。");
    }
  }

  function deleteProject(project: DesignProject) {
    if (!window.confirm(`确定删除「${project.name}」吗？此操作会删除本机保存的项目草稿。`)) return;
    removeProject(project.id);
    setProjects(listProjects());
  }

  async function loadCloudProjects() {
    if (loadingCloud) return;
    setLoadingCloud(true);
    try {
      const cloudProjects = await listCloudProjects();
      const local = listProjects();
      const replacing = cloudProjects.filter(remote => local.some(p => p.id === remote.id && JSON.stringify(p) !== JSON.stringify(remote)));
      if (replacing.length && !window.confirm(`将用服务器版本替换 ${replacing.length} 个本机草稿；未上传的修改可能丢失。是否继续？`)) return;
      cloudProjects.forEach(updateProject);
      setProjects(listProjects());
      setNotice(`已载入 ${cloudProjects.length} 个本人或团队共享项目。`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "加载共享项目失败。"); }
    finally { setLoadingCloud(false); }
  }

  return (
    <main className="db-page">
      <header className="db-page-header">
        <div>
          <button className="db-back-home" onClick={() => navigateTo("/")} aria-label="返回 DesignBuddy 首页">← DesignBuddy</button>
          <p className="db-eyebrow">YOUR WORKSPACE</p>
          <h1>我的项目</h1>
          <p>管理你的设计草稿，继续编辑或打开实时预览。</p>
        </div>
        <div className="db-page-actions"><button className="db-button db-button-secondary" disabled={loadingCloud} onClick={() => void loadCloudProjects()}>{loadingCloud ? "正在同步…" : "载入云端/团队项目"}</button><button className="db-button db-button-primary" onClick={newProject}>＋ 新建项目</button></div>
      </header>
      <div className="db-project-toolbar">
        <label className="db-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目名称或需求" aria-label="搜索项目" />
        </label>
        <span className="db-muted">{visibleProjects.length} 个项目</span>
      </div>
      {notice && <p className="db-alert" role="alert">{notice}</p>}
      {visibleProjects.length > 0 ? (
        <section className="db-project-grid" aria-label="项目列表">
          {visibleProjects.map((project) => (
            <article className="db-project-card" key={project.id}>
              <button className="db-project-thumbnail" onClick={() => navigateTo(projectTaskPath(project.id))} aria-label={`打开项目 ${project.name}`}>
                <div className="db-thumb-nav" />
                <div className="db-thumb-title" />
                <div className="db-thumb-title db-thumb-title-short" />
                <div className="db-thumb-cards"><i /><i /><i /></div>
              </button>
              <div className="db-project-card-body">
                <div className="db-project-title-row">
                  <h2>{project.name}</h2>
                  <button className="db-icon-button" aria-label={`删除项目 ${project.name}`} onClick={() => deleteProject(project)}>删除</button>
                </div>
                <p>{project.prompt || "从一个空白项目开始设计。"}</p>
                <div className="db-project-meta">
                  <span><i className="db-status-dot" />草稿</span>
                  <span>更新于 {formatDate(project.updatedAt)}</span>
                </div>
                <button className="db-button db-button-secondary db-open-project" onClick={() => navigateTo(projectTaskPath(project.id))}>{loadTaskConversation(project.id) ? "继续对话" : "继续编辑"} <span>→</span></button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="db-empty-state">
          <div className="db-empty-icon">✳</div>
          <h2>{query ? "没有找到匹配的项目" : "从第一个设计开始"}</h2>
          <p>{query ? "试试其他关键词，或清空搜索条件。" : "创建项目后，源文件、编辑内容和设计需求会保存在当前浏览器中。"}</p>
          {!query && <button className="db-button db-button-primary" onClick={newProject}>创建第一个项目</button>}
          {query && <button className="db-button db-button-secondary" onClick={() => setQuery("")}>清空搜索</button>}
        </section>
      )}
      <p className="db-storage-note">项目草稿保存在本机浏览器；登录并配置项目 API 后，可载入本人或团队授权的云端项目。</p>
    </main>
  );
}
