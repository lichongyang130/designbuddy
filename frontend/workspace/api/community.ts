import { apiFetch, readJSON } from "../../../apps/web/src/api/client";

/** Who may see a published template. */
export type CommunityVisibility = "private" | "workspace" | "public";

export type CommunityTemplate = {
  id: string;
  ownerId: string;
  sample: string;
  title: string;
  description: string;
  visibility: CommunityVisibility;
  revision: number;
  createdAt: number;
  updatedAt: number;
  publishedAt: number;
  unpublishedAt: number | null;
};

export type CommunityEvent = {
  id: number;
  templateId: string;
  ownerId: string;
  action: "community.publish" | "community.visibility" | "community.unpublish";
  createdAt: number;
};

export const COMMUNITY_VISIBILITY_LABELS: Record<CommunityVisibility, string> = {
  private: "仅自己可见",
  workspace: "工作空间可见",
  public: "已公开",
};

export function communityVisibilityLabel(visibility: CommunityVisibility): string {
  return COMMUNITY_VISIBILITY_LABELS[visibility] ?? "未知范围";
}

/** The templates this account may see. */
export async function listCommunityTemplates(): Promise<CommunityTemplate[]> {
  const body = await readJSON<{ templates?: CommunityTemplate[] }>(
    await apiFetch("/community/templates", { headers: { Accept: "application/json" } }),
  );
  return Array.isArray(body.templates) ? body.templates : [];
}

/** Publish the current state of a template to the community. */
export async function publishCommunityTemplate(input: {
  sample: string;
  title: string;
  description?: string;
  visibility: CommunityVisibility;
  state: unknown;
}): Promise<CommunityTemplate> {
  const body = await readJSON<{ template: CommunityTemplate }>(
    await apiFetch("/community/templates", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return body.template;
}

/** The published content of a template. */
export async function fetchCommunityTemplateState(id: string): Promise<{ template: CommunityTemplate; state: unknown }> {
  return readJSON<{ template: CommunityTemplate; state: unknown }>(
    await apiFetch(`/community/templates/${encodeURIComponent(id)}/state`, { headers: { Accept: "application/json" } }),
  );
}

/** Change who may see a published template. */
export async function setCommunityTemplateVisibility(id: string, visibility: CommunityVisibility): Promise<CommunityTemplate> {
  const body = await readJSON<{ template: CommunityTemplate }>(
    await apiFetch(`/community/templates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    }),
  );
  return body.template;
}

/** Take a published template off the community list. */
export async function unpublishCommunityTemplate(id: string): Promise<void> {
  await readJSON<{ ok: boolean }>(
    await apiFetch(`/community/templates/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }),
  );
}

/** The change history of one published template. */
export async function listCommunityTemplateEvents(id: string): Promise<CommunityEvent[]> {
  const body = await readJSON<{ events?: CommunityEvent[] }>(
    await apiFetch(`/community/templates/${encodeURIComponent(id)}/events`, { headers: { Accept: "application/json" } }),
  );
  return Array.isArray(body.events) ? body.events : [];
}
