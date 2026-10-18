import { apiFetch } from "../../../apps/web/src/api/client";

export interface ProjectMember { userId: string; role: "viewer" | "editor"; createdAt: string; }

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/members`);
  if (!response.ok) return [];
  const body = await response.json() as { members?: ProjectMember[] };
  return body.members ?? [];
}

export async function addProjectMember(projectId: string, userId: string, role: ProjectMember["role"]): Promise<ProjectMember> {
  const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/members`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }),
  });
  const body = await response.json().catch(() => ({} as { error?: string }));
  if (!response.ok) throw new Error(body.error || `添加成员失败 (${response.status})`);
  return (body as { member: ProjectMember }).member;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/members?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`移除成员失败 (${response.status})`);
}
