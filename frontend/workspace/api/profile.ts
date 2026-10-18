import { apiFetch, apiJSON } from "../../../apps/web/src/api/client";

export type ProfilePreference = { key: string; value: unknown; updatedAt: number };
export type ProfileMemory = {
  id: string;
  ownerId: string;
  kind: "note" | "preference" | "correction";
  content: string;
  source: string;
  consent: boolean;
  createdAt: number;
};
export type ProfileDevice = {
  id: string;
  ownerId: string;
  label: string;
  userAgent: string;
  firstSeen: number;
  lastSeen: number;
};
export type ProfileSnapshot = {
  owner: string;
  preferences: ProfilePreference[];
  memories: ProfileMemory[];
  devices: ProfileDevice[];
};

export async function fetchProfile(): Promise<ProfileSnapshot> {
  return apiJSON<ProfileSnapshot>("/profile");
}

export async function saveProfilePreference(key: string, value: unknown): Promise<ProfilePreference> {
  const body = await apiJSON<{ preference: ProfilePreference }>("/profile/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  return body.preference;
}

export async function addProfileMemory(input: { kind?: string; content: string; source?: string }): Promise<ProfileMemory> {
  const body = await apiJSON<{ memory: ProfileMemory }>("/profile/memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, consent: true }),
  });
  return body.memory;
}

export async function deleteProfileMemory(id: string): Promise<void> {
  await apiFetch(`/profile/memories/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function clearProfileMemories(): Promise<void> {
  await apiFetch("/profile/memories", { method: "DELETE" });
}

/** Download the account's own data as a JSON file. */
export async function exportProfile(): Promise<Blob> {
  const response = await apiFetch("/profile/export");
  return response.blob();
}

export async function forgetProfile(): Promise<{ memories: number; preferences: number }> {
  const body = await apiJSON<{ forgotten: { memories: number; preferences: number } }>("/profile/forget", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  return body.forgotten;
}
