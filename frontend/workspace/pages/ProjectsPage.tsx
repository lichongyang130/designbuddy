import { useEffect, useMemo, useState } from "react";
import type { DesignProject } from "../models/project";
import { PROJECT_STORAGE_KEY } from "../models/project";
import {
  createProject,
  listProjects,
  removeProject,
  updateProject,
} from "../projectStore";
import { listCloudProjects } from "../api/projects";
import { listWorkspaces, type Workspace } from "../api/workspaces";
import { projectTaskPath, loadTaskConversation } from "../taskConversation";
import { navigateTo } from "../workspaceRoutes";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import "./projects.css";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "暂无更新时间"
    : new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}
const time = (value: string) => new Date(value).getTime() || 0;
const description = (p: DesignProject) =>
  typeof p.prompt === "string" ? p.prompt : "";
function ProjectFiles({ project }: { project: DesignProject }) {
  const files = project.files.filter((f) => typeof f?.path === "string");
  const tone = [...project.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;
  return (
    <div className={`projects-file-cover tone-${tone}`} aria-hidden="true">
      <div className="projects-cover-top">
        <span>
          <HomeIcon name="folder" size={14} />
          文件概览
        </span>
        <span>{files.length} 个文件</span>
      </div>
      <div className="projects-cover-files">
        {files.length ? (
          files.slice(0, 3).map((f, i) => (
            <div key={`${f.path}-${i}`}>
              <HomeIcon
                name={
                  /\.(html|css|js|ts|tsx|json)$/i.test(f.path)
                    ? "code"
                    : "document"
                }
                size={15}
              />
              <span>{f.path}</span>
            </div>
          ))
        ) : (
          <div>
            <HomeIcon name="document" size={16} />
            <span>空白项目，等待你的想法</span>
          </div>
        )}
      </div>
    </div>
  );
}
export default function ProjectsPage() {
  const [projects, setProjects] = useState<DesignProject[]>(() =>
    listProjects(),
  );
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<"grid" | "list">("grid");
  useEffect(() => {
    let active = true;
    void listWorkspaces()
      .then((w) => {
        if (active) setWorkspaces(w);
      })
      .catch(() => {
        if (active) setWorkspaces([]);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const refresh = () => setProjects(listProjects());
    const storage = (e: StorageEvent) => {
      if (!e.key || e.key === PROJECT_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const workspaceName = (p: DesignProject) =>
    workspaces.find((w) => w.id === p.workspaceId)?.name ||
    p.workspaceName ||
    "";
  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return projects
      .filter(
        (p) =>
          (!needle ||
            `${p.name} ${description(p)}`
              .toLocaleLowerCase()
              .includes(needle)) &&
          (!workspaceFilter ||
            (workspaceFilter === "__none"
              ? !p.workspaceId
              : p.workspaceId === workspaceFilter)),
      )
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name, "zh-CN")
          : time(sort === "created" ? b.createdAt : b.updatedAt) -
            time(sort === "created" ? a.createdAt : a.updatedAt),
      );
  }, [projects, query, workspaceFilter, sort]);
  function newProject() {
    try {
      const p = createProject("", "未命名设计项目");
      setProjects(listProjects());
      navigateTo(projectTaskPath(p.id));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "创建项目失败。");
    }
  }
  function deleteProject(p: DesignProject) {
    if (
      !window.confirm(
        `确定删除「${p.name}」吗？仅删除本机项目草稿，云端版本不受影响。`,
      )
    )
      return;
    try {
      removeProject(p.id);
      setProjects(listProjects());
      setNotice(`已删除「${p.name}」的本机草稿。`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "删除失败，项目未确认删除。");
    }
  }
  async function loadCloudProjects() {
    if (loadingCloud) return;
    setLoadingCloud(true);
    setNotice("");
    try {
      const remote = await listCloudProjects(),
        local = listProjects(),
        replacing = remote.filter((r) =>
          local.some(
            (p) => p.id === r.id && JSON.stringify(p) !== JSON.stringify(r),
          ),
        );
      if (
        replacing.length &&
        !window.confirm(
          `将用服务器版本替换 ${replacing.length} 个本机草稿；未上传的修改可能丢失。是否继续？`,
        )
      )
        return;
      remote.forEach(updateProject);
      setProjects(listProjects());
      setNotice(`已载入 ${remote.length} 个本人或团队共享项目。`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "载入云端项目失败，请重试。");
    } finally {
      setLoadingCloud(false);
    }
  }
  const filtered = !!query.trim() || !!workspaceFilter;
  return (
    <div className="workbuddy-app projects-workspace">
      <WorkBuddySidebar
        active="projects"
        projectCount={projects.length}
        workspaceCount={workspaces.length}
        go={navigateTo}
        setNotice={setNotice}
      />
      <main className="projects-main">
        <header className="projects-topbar">
          <div>
            <HomeIcon name="folder" size={17} />
            <span>工作空间</span>
            <span className="projects-slash">/</span>
            <strong>我的项目</strong>
          </div>
          <button
            className="projects-quiet-button"
            onClick={() => navigateTo("/inspiration")}
          >
            <HomeIcon name="grid" />
            浏览模板
          </button>
        </header>
        <div className="projects-content">
          <section className="projects-heading">
            <div>
              <span className="projects-eyebrow">你的创作，持续向前</span>
              <h1>
                我的项目<span>{projects.length}</span>
              </h1>
              <p>从上次停下的地方继续，把想法慢慢变成作品。</p>
            </div>
            <div className="projects-heading-actions">
              <button
                className="projects-secondary"
                disabled={loadingCloud}
                onClick={() => void loadCloudProjects()}
              >
                <HomeIcon name="refresh" size={15} />
                {loadingCloud ? "正在载入…" : "载入云端/团队项目"}
              </button>
              <button
                className="projects-primary"
                aria-label="＋ 新建项目"
                onClick={newProject}
              >
                <HomeIcon name="plus" size={16} />
                新建项目
              </button>
            </div>
          </section>
          <section className="projects-controls" aria-label="项目筛选与显示">
            <div className="projects-scope">
              <button
                className={!workspaceFilter ? "is-selected" : ""}
                aria-pressed={!workspaceFilter}
                onClick={() => setWorkspaceFilter("")}
              >
                全部项目<span>{projects.length}</span>
              </button>
              <button
                className={workspaceFilter === "__none" ? "is-selected" : ""}
                aria-pressed={workspaceFilter === "__none"}
                onClick={() => setWorkspaceFilter("__none")}
              >
                未分组
              </button>
            </div>
            <label className="projects-search">
              <HomeIcon name="search" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索项目名称或需求"
                aria-label="搜索项目"
              />
              {query && (
                <button aria-label="清空项目搜索" onClick={() => setQuery("")}>
                  ×
                </button>
              )}
            </label>
          </section>
          <div className="projects-result-bar">
            <span>
              {filtered
                ? `找到 ${visibleProjects.length} 个项目`
                : `共 ${projects.length} 个项目`}
              <i />
              本机草稿
            </span>
            <div>
              <select
                aria-label="按工作空间筛选"
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
              >
                <option value="">全部工作空间</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
                <option value="__none">未分组</option>
              </select>
              <select
                aria-label="项目排序"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="updated">最近更新</option>
                <option value="created">最近创建</option>
                <option value="name">名称排序</option>
              </select>
              <div
                className="projects-view-switch"
                role="group"
                aria-label="项目显示方式"
              >
                <button
                  aria-label="卡片视图"
                  aria-pressed={view === "grid"}
                  onClick={() => setView("grid")}
                >
                  <HomeIcon name="grid" size={16} />
                </button>
                <button
                  aria-label="列表视图"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                >
                  <HomeIcon name="panel" size={16} />
                </button>
              </div>
            </div>
          </div>
          {notice && (
            <div className="projects-notice" role="alert">
              <HomeIcon name="bell" size={16} />
              <p>{notice}</p>
              <button aria-label="关闭项目提示" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {visibleProjects.length ? (
            <section
              className={`projects-collection is-${view}`}
              aria-label="项目列表"
            >
              {visibleProjects.map((p) => (
                <article className="projects-card" key={p.id}>
                  <button
                    className="projects-cover-button"
                    aria-label={`打开项目 ${p.name}`}
                    onClick={() => navigateTo(projectTaskPath(p.id))}
                  >
                    <ProjectFiles project={p} />
                  </button>
                  <div className="projects-card-body">
                    <div className="projects-card-title">
                      <button
                        onClick={() => navigateTo(projectTaskPath(p.id))}
                        title={p.name}
                      >
                        <h2>{p.name}</h2>
                      </button>
                      <button
                        className="projects-delete"
                        aria-label={`删除项目 ${p.name}`}
                        onClick={() => deleteProject(p)}
                      >
                        删除
                      </button>
                    </div>
                    <p className="projects-description">
                      {description(p) || "空白草稿，等待你的下一个想法。"}
                    </p>
                    <div className="db-project-meta projects-card-meta">
                      <span className="projects-draft">
                        <i />
                        草稿
                      </span>
                      {workspaceName(p) && (
                        <span className="projects-workspace-tag">
                          工作空间：{workspaceName(p)}
                        </span>
                      )}
                    </div>
                    <footer>
                      <time dateTime={p.updatedAt}>
                        {formatDate(p.updatedAt)}
                      </time>
                      <button
                        className="db-open-project"
                        onClick={() => navigateTo(projectTaskPath(p.id))}
                      >
                        {loadTaskConversation(p.id) ? "继续对话" : "继续编辑"}
                        <HomeIcon name="chevron" size={13} />
                      </button>
                    </footer>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section className="projects-empty" aria-label="项目空状态">
              <div>
                <HomeIcon name={filtered ? "search" : "folder"} size={32} />
              </div>
              <h2>
                {filtered ? "没有找到匹配的项目" : "给下一个想法，一个起点"}
              </h2>
              <p>
                {filtered
                  ? "试试其他关键词，或重置工作空间筛选。"
                  : "创建你的第一个项目，在对话和编辑之间自由继续。"}
              </p>
              {filtered ? (
                <button
                  className="projects-secondary"
                  onClick={() => {
                    setQuery("");
                    setWorkspaceFilter("");
                  }}
                >
                  清空筛选
                </button>
              ) : (
                <button className="projects-primary" onClick={newProject}>
                  <HomeIcon name="plus" />
                  创建第一个项目
                </button>
              )}
            </section>
          )}
          <footer className="projects-storage-note">
            <HomeIcon name="shield" size={14} />
            <span>
              草稿保存在当前浏览器。云端/团队项目需手动载入，不会自动上传或覆盖本机修改。
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
