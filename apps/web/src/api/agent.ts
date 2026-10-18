import { apiFetch } from "./client";

export interface AgentTaskRequest {
  expertId: string;
  input: unknown;
}

export interface AgentTaskResponse {
  taskId?: string;
  result?: unknown;
}

export async function runAgentTask(request: AgentTaskRequest): Promise<AgentTaskResponse> {
  const response = await apiFetch("/agent/run", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error('Failed to run agent task');
  }

  return response.json();
}
