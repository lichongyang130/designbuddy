import { useCallback, useEffect, useState } from "react";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { MarketNavigation } from "../MarketNavigation";
import {
  changeWorkspaceMemberRole,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  joinWorkspace,
  listWorkspaces,
  removeWorkspaceMember,
  setWorkspaceMember,
  updateWorkspaceJoinCode,
  workspaceRoleLabel,
  type Workspace,
  type WorkspaceDetail,
  type WorkspaceRole,
} from "../api/workspaces";
import { readActiveWorkspaceId, writeActiveWorkspaceId } from "../workspaceStore";
import { navigateTo } from "../workspaceRoutes";
import { projectTaskPath } from "../taskConversation";
import "./workspaces.css";

const ROLES: WorkspaceRole[] = ["admin", "member", "viewer"];

/**
 * Workspaces and organisation members.
 *
 * A workspace is the tenant of a project: the role a person has there decides
 * whether the project may be read, changed or only looked at. Everything on
 * this page is decided by the server, the page only shows what it returned.
 */
export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string>(() => readActiveWorkspaceId());
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<WorkspaceRole>("member");
  const [joinCode, setJoinCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listWorkspaces();
      setWorkspaces(list);
      setError("");
      const stored = readActiveWorkspaceId();
      const next = list.find((item) => item.id === selectedId)?.id
        ?? list.find((item) => item.id === stored)?.id
        ?? list[0]?.id
        ?? "";
      setSelectedId(next);
      if (next) writeActiveWorkspaceId(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "工作空间服务暂不可用。");
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(async (workspaceId: string) => {
    if (!workspaceId) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await getWorkspace(workspaceId));
      setError("");
    } catch (cause) {
      setDetail(null);
      setError(cause instanceof Error ? cause.message : "读取工作空间失败。");
    }
  }, []);

  useEffect(() => {
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      setNotice(success);
      setError("");
      await load();
      await loadDetail(selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  const canManage = detail?.role === "owner" || detail?.role === "admin";

  return (
    <div className="workbuddy-app workspace-workspace">
      <WorkBuddySidebar
        active="plugins"
        go={navigateTo}
        setNotice={setNotice}
        projectCount={0}
        workspaceCount={workspaces.length}
      />
      <main className="ws-main" aria-label="工作空间">
        <header className="ws-topbar">
          <MarketNavigation active="connectors" className="ws-nav" />
          <button className="ws-button" type="button" onClick={() => void load()}>刷新</button>
        </header>
        <div className="ws-content">
          <section className="ws-hero">
            <div>
              <span className="ws-eyebrow">组织与成员</span>
              <h1>工作空间</h1>
              <p>工作空间是项目的归属单位：成员在其中的角色决定项目能读、能改还是只能看。</p>
            </div>
          </section>

          {(error || notice) && (
            <p className={error ? "ws-message is-error" : "ws-message"} role="status">{error || notice}</p>
          )}

          <section className="ws-card" aria-label="我的工作空间">
            <h2>我的工作空间</h2>
            <p className="ws-note">只有服务器确认的成员关系才会出现在这里。</p>
            <ul className="ws-list">
              {workspaces.map((workspace) => (
                <li key={workspace.id} className={workspace.id === selectedId ? "is-selected" : ""}>
                  <button type="button" className="ws-list-open" onClick={() => { setSelectedId(workspace.id); writeActiveWorkspaceId(workspace.id); }}>
                    <strong>{workspace.name}</strong>
                    <span>{workspaceRoleLabel(workspace.role)} · 创建于 {new Date(workspace.createdAt).toLocaleDateString("zh-CN")}</span>
                  </button>
                </li>
              ))}
              {!workspaces.length && <li className="ws-empty">还没有工作空间。创建一个，或用加入码加入同事的工作空间。</li>}
            </ul>
            <div className="ws-forms">
              <label>
                新工作空间名称
                <input
                  aria-label="新工作空间名称"
                  value={name}
                  maxLength={80}
                  placeholder="例如：品牌设计组"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <button
                className="ws-button is-primary"
                type="button"
                disabled={busy || !name.trim()}
                onClick={() => void run(async () => { await createWorkspace(name.trim()); setName(""); }, "已创建工作空间，你是它的所有者。")}
              >
                创建工作空间
              </button>
              <label>
                加入码
                <input
                  aria-label="加入码"
                  value={code}
                  maxLength={12}
                  placeholder="例如：K7M2QP"
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
              </label>
              <button
                className="ws-button"
                type="button"
                disabled={busy || !code.trim()}
                onClick={() => void run(async () => { await joinWorkspace(code.trim()); setCode(""); }, "已加入工作空间，角色为成员。")}
              >
                加入工作空间
              </button>
            </div>
          </section>

          {detail && (
            <section className="ws-card" aria-label="工作空间详情">
              <h2>{detail.workspace.name}</h2>
              <p className="ws-note">
                我的角色：{workspaceRoleLabel(detail.role)} · 成员 {detail.members.length} 人 · 项目 {detail.projects.length} 个
              </p>

              {(detail.workspace.joinCode || joinCode) && (
                <p className="ws-code">
                  加入码：<code>{joinCode || detail.workspace.joinCode}</code>
                  <span>把它交给同事，对方就能以成员身份加入。</span>
                </p>
              )}
              {canManage && !detail.workspace.joinCode && !joinCode && (
                <p className="ws-note">加入已关闭：现在没有人能用旧码加入这个工作空间。</p>
              )}

              <table className="ws-table">
                <thead><tr><th>成员</th><th>角色</th><th>操作</th></tr></thead>
                <tbody>
                  {detail.members.map((member) => (
                    <tr key={member.userId}>
                      <td><code>{member.userId}</code></td>
                      <td>{workspaceRoleLabel(member.role)}</td>
                      <td>
                        {canManage && member.userId !== detail.workspace.ownerId && (
                          <>
                            <select
                              aria-label={`${member.userId} 的角色`}
                              value={member.role}
                              onChange={(event) => void run(
                                () => changeWorkspaceMemberRole(detail.workspace.id, member.userId, event.target.value as WorkspaceRole).then(() => undefined),
                                "已更新成员角色。",
                              )}
                            >
                              {ROLES.map((role) => <option key={role} value={role}>{workspaceRoleLabel(role)}</option>)}
                            </select>
                            <button
                              className="ws-button"
                              type="button"
                              disabled={busy}
                              onClick={() => void run(
                                () => removeWorkspaceMember(detail.workspace.id, member.userId).then(() => undefined),
                                "已移除该成员。",
                              )}
                            >
                              移除
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {canManage && (
                <div className="ws-forms">
                  <label>
                    成员用户 ID
                    <input
                      aria-label="成员用户 ID"
                      value={memberUserId}
                      placeholder="输入同事的账号 ID"
                      onChange={(event) => setMemberUserId(event.target.value)}
                    />
                  </label>
                  <label>
                    角色
                    <select aria-label="成员角色" value={memberRole} onChange={(event) => setMemberRole(event.target.value as WorkspaceRole)}>
                      {ROLES.map((role) => <option key={role} value={role}>{workspaceRoleLabel(role)}</option>)}
                    </select>
                  </label>
                  <button
                    className="ws-button is-primary"
                    type="button"
                    disabled={busy || !memberUserId.trim()}
                    onClick={() => void run(async () => {
                      await setWorkspaceMember(detail.workspace.id, memberUserId.trim(), memberRole);
                      setMemberUserId("");
                    }, "已更新成员名单。")}
                  >
                    添加或更新成员
                  </button>
                  <button
                    className="ws-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(async () => {
                      const result = await updateWorkspaceJoinCode(detail.workspace.id, { rotate: true });
                      setJoinCode(result.joinCode);
                    }, "已更换加入码，旧码立即失效。")}
                  >
                    更换加入码
                  </button>
                  <button
                    className="ws-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(async () => {
                      await updateWorkspaceJoinCode(detail.workspace.id, { enabled: false });
                      setJoinCode("");
                    }, "已关闭加入，别人不能再用旧码进来。")}
                  >
                    关闭加入
                  </button>
                  <button
                    className="ws-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(async () => {
                      const result = await updateWorkspaceJoinCode(detail.workspace.id, { enabled: true });
                      setJoinCode(result.joinCode);
                    }, "已重新开启加入，新码如下。")}
                  >
                    重新开启加入
                  </button>
                </div>
              )}

              {detail.role === "owner" && (
                <button
                  className="ws-button is-danger"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`确定删除工作空间「${detail.workspace.name}」吗？此操作不可撤销。`)) return;
                    void run(async () => {
                      await deleteWorkspace(detail.workspace.id);
                      writeActiveWorkspaceId("");
                      setSelectedId("");
                    }, "已删除工作空间。");
                  }}
                >
                  删除工作空间
                </button>
              )}

              <h3>工作空间内的项目</h3>
              <ul className="ws-projects">
                {detail.projects.map((project) => (
                  <li key={project.id}>
                    <button type="button" className="ws-list-open" onClick={() => navigateTo(projectTaskPath(project.id))}>
                      <strong>{project.name}</strong>
                      <span>更新于 {new Date(project.updatedAt).toLocaleString("zh-CN")}</span>
                    </button>
                  </li>
                ))}
                {!detail.projects.length && <li className="ws-empty">这个工作空间还没有项目。</li>}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
