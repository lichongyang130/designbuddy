export type PluginState = 'pending' | 'active' | 'error' | 'disposed'

export interface ConfigField {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'textarea'
  default?: unknown
  options?: Array<{ label: string; value: string | number }>
  description?: string
  placeholder?: string
}

export interface PluginInfo {
  id: string
  name: string
  title: string
  description: string
  category: string
  version: string
  author: string
  tags: string[]
  state: PluginState
  error: string | null
  provides: string[]
  inject: string[]
  missing: string[]
  config: Record<string, unknown>
  configSchema: ConfigField[]
  appliedAt: number | null
  order: number
}

export interface MarketEntry {
  name: string
  title: string
  description: string
  category: string
  tags: string[]
  version: string
  author: string
  order: number
  configSchema: ConfigField[]
  required: boolean
  state: PluginState | 'unloaded'
  error: string | null
  config: Record<string, unknown>
  provides: string[]
  missing: string[]
}

export interface ModelInfo {
  id: string
  label: string
  provider: string
  contextWindow: number
  supportsTools: boolean
}

export interface Expert {
  name: string
  title: string
  description: string
  tools?: string[]
}

export interface ToolDescriptor {
  name: string
  title: string
  description: string
  scope: 'read' | 'write' | 'danger'
  owner: string
}

export interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  agent: string
  eventCount: number
}

export interface MemoryEntry {
  id: string
  kind: string
  text: string
  tags: string[]
  at: number
}

export interface SkillInfo {
  name: string
  title: string
  description: string
  path: string
}

export interface PlanItem {
  id: string
  text: string
  status: 'todo' | 'doing' | 'done'
}

export interface LogEntry {
  id: number
  at: number
  level: 'debug' | 'info' | 'warn' | 'error'
  source: string
  message: string
}

export type PolicyMode = 'auto' | 'approve-writes' | 'readonly'

export interface ApprovalRequest {
  id: string
  tool: string
  scope: 'read' | 'write' | 'danger'
  args: Record<string, unknown>
  sessionId: string
  agent: string
  createdAt: number
  status: 'pending' | 'allowed' | 'denied' | 'timeout' | 'aborted'
  resolvedAt: number | null
}

export interface PolicySnapshot {
  mode: PolicyMode
  allow: string[]
  pending: ApprovalRequest[]
}

export interface AppState {
  ok: boolean
  services: string[]
  plugins: PluginInfo[]
  internalForks: number
  models: ModelInfo[]
  defaultModel: string | null
  experts: Expert[]
  tools: ToolDescriptor[]
  sessions: SessionSummary[]
  memory: MemoryEntry[]
  skills: SkillInfo[]
  promptSections: string[]
  policy: PolicySnapshot | null
  logs: LogEntry[]
  workspaceRoot: string | null
}

export type SessionEvent =
  | { type: 'turn-start'; turnId: string; agent: string; model: string; text: string }
  | { type: 'user'; text: string }
  | { type: 'assistant'; text: string; agent: string; model: string }
  | { type: 'tool-call'; callId: string; name: string; args: Record<string, unknown>; agent: string }
  | {
      type: 'tool-result'
      callId: string
      name: string
      ok: boolean
      result?: string
      error?: string
      durationMs: number
    }
  | { type: 'note'; title: string; text: string }
  | { type: 'handoff'; from: string; to: string; reason: string }
  | { type: 'error'; message: string }
  | { type: 'turn-end'; turnId: string; reason: string }

export interface StoredEvent {
  seq: number
  at: number
  event: SessionEvent
}
