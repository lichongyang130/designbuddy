import { apiFetch } from "./client";

export interface Expert {
  id: string;
  name: string;
  description?: string;
  skills?: string[];
}

export async function listExperts(): Promise<Expert[]> {
  const response = await apiFetch("/experts");
  if (!response.ok) {
    throw new Error('Failed to load experts');
  }
  return response.json();
}

export async function createExpert(data: Partial<Expert>): Promise<Expert> {
  const response = await apiFetch("/experts", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to create expert');
  }

  return response.json();
}

export async function updateExpert(id: string, data: Partial<Expert>): Promise<Expert> {
  const response = await apiFetch(`/experts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to update expert');
  }

  return response.json();
}
