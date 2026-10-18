export type PreviewFramework = "react-vite" | "nextjs";
export type PreviewStatus = "starting" | "ready" | "degraded" | "stopped" | "failed";

export interface PreviewFile {
  path: string;
  content: string;
}

export interface PreviewActor {
  userId: string;
  roles?: string[];
}

export interface PreviewSession {
  id: string;
  projectId: string;
  ownerId: string;
  framework: PreviewFramework;
  status: PreviewStatus;
  version: number;
  previewUrl?: string;
  createdAt: number;
  updatedAt: number;
  lastHeartbeatAt?: number;
}

export interface PreviewStartInput {
  sessionId: string;
  projectId: string;
  framework: PreviewFramework;
  version: number;
  files: PreviewFile[];
}

export interface PreviewUpdateInput extends PreviewStartInput {
  changedPaths: string[];
}

export interface PreviewHealth {
  healthy: boolean;
  checkedAt: number;
  message?: string;
  cpuPercent?: number;
  memoryBytes?: number;
}

export interface PreviewAdapter {
  /**
   * Adapter boundary for an isolated runtime (container, remote worker, or
   * dedicated preview service). Do not implement this by evaluating untrusted
   * generated source directly inside the API server process.
   */
  start(input: PreviewStartInput): Promise<{ url: string }>;
  update(input: PreviewUpdateInput): Promise<void>;
  stop(sessionId: string): Promise<void>;
  health(sessionId: string): Promise<PreviewHealth>;
}

export interface PreviewEvent {
  sessionId: string;
  type: "session-ready" | "files-updated" | "runtime-health" | "runtime-error" | "session-stopped";
  version: number;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export interface PreviewRuntimeError {
  id: string;
  sessionId: string;
  projectId: string;
  ownerId: string;
  name: string;
  message: string;
  stack?: string;
  source?: string;
  timestamp: number;
  fingerprint: string;
  count: number;
}

export interface PreviewErrorInput {
  name?: string;
  message: string;
  stack?: string;
  source?: string;
  timestamp?: number;
}
