/** One expert is a role plus a policy: instructions, tools and default model. */
export interface Expert {
  name: string
  title: string
  description: string
  instructions: string
  /** Tool allowlist. Omit to allow every registered tool. */
  tools?: string[]
  /** Preferred model id. Falls back to the session model, then the router default. */
  model?: string
  tags?: string[]
}

export interface RunOptions {
  sessionId: string
  /** New user input. Omit to continue from the existing history. */
  input?: string
  agent?: string
  model?: string
}

export interface TurnResult {
  turnId: string
  text: string
  steps: number
  reason: 'stop' | 'max-steps' | 'error' | 'aborted'
  error?: string
}

export type AgentPhase = 'thinking' | 'tools' | 'idle'
