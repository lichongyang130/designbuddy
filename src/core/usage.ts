/**
 * Usage ledger + free-tier quota.
 *
 * The product has no payment provider and no accounts, so "billing" here means
 * the part that actually exists: **metering and a limit**. Every agent run
 * appends one entry (tokens in/out, model, wall time). The daily budget is
 * enforced by the host before a run starts, so the number in the 会员中心 is a
 * number the backend will act on, not a decoration.
 *
 * Token counts are estimated from text: providers differ in tokenizers, and a
 * wrong-but-consistent estimate is more useful than a "precise" number that
 * changes with every adapter. `estimateTokens` is deliberately conservative
 * (CJK ≈ 1 token/char, ASCII ≈ 0.28 token/char).
 *
 * @module designbuddy/core/usage
 */

export interface UsageEntry {
  at: number
  sessionId: string
  presetId: string
  model: string
  inputTokens: number
  outputTokens: number
  ms: number
  status: string
}

export interface UsageQuota {
  limit: number
  used: number
  remaining: number
  /** When the daily window resets (local midnight). */
  resetsAt: number
}

export interface UsageSummary {
  today: { runs: number; tokens: number; ms: number }
  total: { runs: number; tokens: number }
  quota: UsageQuota
  models: { model: string; runs: number; tokens: number }[]
  recent: UsageEntry[]
}

export interface UsagePersister {
  append(entry: UsageEntry): void
}

export interface UsageOptions {
  persister?: UsagePersister
  /** Free-tier budget per local day, in estimated tokens. */
  dailyTokenLimit?: number
  now?: () => number
}

export const DEFAULT_DAILY_TOKENS = 200_000

/** CJK counts ~1 token per character; latin text ~0.28. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let wide = 0
  for (const char of text) if (char.codePointAt(0)! > 0x2e7f) wide += 1
  const narrow = [...text].length - wide
  return Math.round(wide + narrow * 0.28)
}

function startOfDay(at: number): number {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function endOfDay(at: number): number {
  const date = new Date(startOfDay(at))
  date.setDate(date.getDate() + 1)
  return date.getTime()
}

export class UsageService {
  #entries: UsageEntry[] = []
  #persister?: UsagePersister
  #limit: number
  #now: () => number

  constructor(options: UsageOptions = {}) {
    this.#persister = options.persister
    this.#limit = options.dailyTokenLimit ?? DEFAULT_DAILY_TOKENS
    this.#now = options.now ?? Date.now
  }

  /** Replay persisted entries (called once at boot). */
  hydrate(entries: UsageEntry[]): void {
    this.#entries = [...entries].sort((a, b) => a.at - b.at)
  }

  get dailyLimit(): number {
    return this.#limit
  }

  /** Append one run. Writing to disk is the store's job, not ours. */
  record(entry: UsageEntry): UsageEntry {
    const normalised: UsageEntry = {
      at: entry.at || this.#now(),
      sessionId: entry.sessionId,
      presetId: entry.presetId,
      model: entry.model || 'unknown',
      inputTokens: Math.max(0, Math.round(entry.inputTokens)),
      outputTokens: Math.max(0, Math.round(entry.outputTokens)),
      ms: Math.max(0, Math.round(entry.ms)),
      status: entry.status || 'ok',
    }
    this.#entries.push(normalised)
    this.#persister?.append(normalised)
    return normalised
  }

  /** Used / remaining tokens for the local day containing `at`. */
  quota(at = this.#now()): UsageQuota {
    const from = startOfDay(at)
    const used = this.#entries
      .filter((entry) => entry.at >= from && entry.at < endOfDay(at))
      .reduce((sum, entry) => sum + entry.inputTokens + entry.outputTokens, 0)
    return {
      limit: this.#limit,
      used,
      remaining: Math.max(0, this.#limit - used),
      resetsAt: endOfDay(at),
    }
  }

  /** The host calls this before a run; the client calls it to render. */
  canRun(at = this.#now()): { ok: boolean; quota: UsageQuota } {
    const quota = this.quota(at)
    return { ok: quota.remaining > 0, quota }
  }

  summary(at = this.#now()): UsageSummary {
    const from = startOfDay(at)
    const today = this.#entries.filter((entry) => entry.at >= from && entry.at < endOfDay(at))
    const bucket = (list: UsageEntry[]) => ({
      runs: list.length,
      tokens: list.reduce((sum, entry) => sum + entry.inputTokens + entry.outputTokens, 0),
      ms: list.reduce((sum, entry) => sum + entry.ms, 0),
    })

    const byModel = new Map<string, { model: string; runs: number; tokens: number }>()
    for (const entry of this.#entries) {
      const row = byModel.get(entry.model) ?? { model: entry.model, runs: 0, tokens: 0 }
      row.runs += 1
      row.tokens += entry.inputTokens + entry.outputTokens
      byModel.set(entry.model, row)
    }

    return {
      today: bucket(today),
      total: bucket(this.#entries),
      quota: this.quota(at),
      models: [...byModel.values()].sort((a, b) => b.tokens - a.tokens),
      recent: this.#entries.slice(-8).reverse(),
    }
  }
}
