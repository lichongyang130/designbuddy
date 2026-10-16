import { apiFetch } from "./client";

export interface Skill {
  id: string;
  name: string;
  description?: string;
}

export async function listSkills(): Promise<Skill[]> {
  const response = await apiFetch("/skills");
  if (!response.ok) {
    throw new Error('Failed to load skills');
  }
  return response.json();
}

export async function executeSkill(id: string, input: unknown): Promise<unknown> {
  const response = await apiFetch(`/skills/${encodeURIComponent(id)}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error('Failed to execute skill');
  }

  return response.json();
}
