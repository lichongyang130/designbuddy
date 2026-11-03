/**
 * `mock-llm` — deterministic model adapters so the whole framework runs offline.
 *
 * DSH ships `test-support/llm-mock-server` and `test-support/llm-replay` for the
 * same reason: an agent framework you cannot run without a network is a
 * framework you cannot test. This plugin registers adapters that obey the same
 * `LlmAdapter` seam as a real vendor, so nothing downstream can tell the
 * difference.
 *
 * The mock follows a plan: at each step it calls the first planned tool it has
 * not called yet in this turn, then answers once the plan is exhausted. That
 * exercises the multi-step loop instead of pretending one model call is enough.
 *
 * @module designbuddy/plugins/mock-llm
 */

import type { Context } from '../kernel/index.ts'
import type { LlmAdapter, LlmChunk, LlmRequest, Message, ToolCallPart } from '../core/llm.ts'
import { textOf, toolCallsOf } from '../core/llm.ts'
import { ModelRouter } from '../core/router.ts'
import { nextId } from '../core/schema.ts'

export const name = 'mockLlm'

export const inject = ['llm']

export interface Config {
  plan?: string[]
}

export interface MockAdapterOptions {
  id: string
  models?: string[]
  /** Tool names in the order the mock should try to call them. */
  plan?: string[]
  /** Reject the first call instead of streaming, to demo router fallback. */
  failFirstCall?: string
}

export const DEFAULT_PLAN = ['figma.inspect_frame', 'memory.recall', 'expert.consult', 'memory.save']

const PREAMBLE: Record<string, string> = {
  'figma.inspect_frame': '先读取设计稿的真实 token，避免凭印象改稿。',
  'memory.recall': '再确认历史上已经定过的设计决策。',
  'expert.consult': '这个问题需要专业判断，我分派给对应专家。',
  'memory.save': '把结论写进设计记忆，下次不必重复讨论。',
}

export class MockAdapter implements LlmAdapter {
  readonly id: string
  readonly models: readonly string[]
  #plan: string[]
  #failFirstCall?: string
  #failed = false

  constructor(options: MockAdapterOptions) {
    this.id = options.id
    this.models = options.models ?? ['mock-1']
    this.#plan = options.plan ?? DEFAULT_PLAN
    this.#failFirstCall = options.failFirstCall
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmChunk> {
    if (this.#failFirstCall && !this.#failed) {
      this.#failed = true
      throw new Error(this.#failFirstCall)
    }

    const decision = decide(request, this.#plan)
    if (decision.text !== '') yield { type: 'text-delta', text: decision.text }
    if (decision.call) yield { type: 'tool-call', call: decision.call }
    yield {
      type: 'usage',
      inputTokens: request.messages.reduce((total, message) => total + textOf(message).length, 0),
      outputTokens: decision.text.length,
    }
  }
}

import { CONNECTORS } from '../connectors/catalog.ts'

const CONNECTOR_IDS = new Set(CONNECTORS.map((item) => item.id))

export interface Decision {
  text: string
  call?: ToolCallPart
}

/**
 * The decision function is exported because it is the part tests care about:
 * given a request and a plan, which tool (if any) should this step call?
 */
export function decide(request: LlmRequest, plan: string[]): Decision {
  const userIndex = request.messages.findLastIndex((message) => message.role === 'user')
  const turn = userIndex >= 0 ? request.messages.slice(userIndex + 1) : request.messages
  const prompt = userIndex >= 0 ? textOf(request.messages[userIndex]!) : ''

  const called = new Set(
    turn.flatMap((message) =>
      message.role === 'assistant' ? toolCallsOf(message).map((call) => call.name) : [],
    ),
  )
  const results = turn.filter((message) => message.role === 'tool')
  const available = new Set(request.tools.map((tool) => tool.name))

  // 「技能」页点卡片会往输入框里写 `@工具名`：用户点名要哪个工具就先跑哪个，
  // 其次才看消息里有没有文件路径，最后才回落到预设计划。
  const mentioned = mentionedTool(prompt, available)
  const office = officeToolFor(prompt)
  const connector = connectorToolFor(prompt, available, called)
  const next = (mentioned && !called.has(mentioned) ? mentioned : undefined)
    ?? (office && available.has(office) && !called.has(office) ? office : undefined)
    ?? connector
    ?? plan.find((toolName) => available.has(toolName) && !called.has(toolName))
  if (next) {
    return {
      text: PREAMBLE[next] ?? `调用 ${next}。`,
      call: {
        type: 'tool_call',
        id: nextId('call'),
        name: next,
        arguments: argsFor(next, prompt, results),
      },
    }
  }
  return { text: finalAnswer(prompt, results) }
}

function argsFor(toolName: string, prompt: string, results: Message[]): Record<string, unknown> {
  switch (toolName) {
    case 'figma.inspect_frame':
      return { frameId: 'home-hero' }
    case 'memory.recall':
      return { query: pickQuery(prompt) }
    case 'expert.consult':
      return { expert: pickExpert(prompt), question: prompt }
    case 'memory.save':
      return { topic: '首屏改版', content: summarizeResults(results) }
    default:
      if (toolName.startsWith('office.read_')) return { filePath: officePath(prompt) }
      if (toolName.includes('.')) return connectorArgs(toolName, prompt)
      return {}
  }
}

/**
 * 用户消息里点名了某个已连接的连接器（例如「用通达信查一下 600519」），
 * 就优先调用它的只读工具——否则演示环境里连接器永远轮不到被调用，
 * 「连上就能用」这句话就成了空话。
 */
export function connectorToolFor(prompt: string, available: Set<string>, called: Set<string>): string | undefined {
  for (const manifest of CONNECTORS) {
    if (!prompt.includes(manifest.name)) continue
    for (const spec of manifest.tools) {
      if (spec.write) continue
      const name = manifest.id + '.' + spec.name
      if (available.has(name) && !called.has(name)) return name
    }
  }
  return undefined
}

/** 连接器工具的参数：能从句子里捞到就带过去，捞不到交给工具自己兜底。 */
export function connectorArgs(toolName: string, prompt: string): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  const symbol = prompt.match(/\b(\d{6})\b/)
  if (symbol) args.symbol = symbol[1]
  const repo = prompt.match(/\b([\w-]+)\/([\w.-]+)\b/)
  if (repo && toolName.startsWith('github.')) {
    args.owner = repo[1]
    args.repo = repo[2]
  }
  const path = prompt.match(/[\w./-]+\.(?:ts|tsx|js|jsx|css|md|json)\b/)
  if (path && /file|doc|page/.test(toolName)) args.path = path[0]
  if (args.symbol === undefined && /搜|查|找|search/i.test(prompt)) args.query = prompt.slice(0, 30)
  return args
}

/** 能从用户消息里直接拿到参数的工具，才允许被 `@` 点名优先执行。 */
const MENTIONABLE = /^(?:office\.read_\w+|office\.docx_formulas|memory\.(?:save|recall)|expert\.consult|figma\.inspect_frame)$/

export function mentionedTool(prompt: string, available: Set<string>): string | undefined {
  for (const match of prompt.matchAll(/@([a-zA-Z][\w.-]*)/g)) {
    const candidate = match[1]!
    if (!available.has(candidate)) continue
    // 连接器工具（`tdx.quote`）也能被 @ 点名，前缀必须是真的连上了的目录 id
    if (MENTIONABLE.test(candidate) || CONNECTOR_IDS.has(candidate.split('.')[0]!)) return candidate
  }
  return undefined
}

function officePath(prompt: string): string {
  return /(\/[^\s，。；]+?\.(?:pptx|docx|xlsx|pdf))/i.exec(prompt)?.[1] ?? ''
}

function officeToolFor(prompt: string): string | null {
  const match = officePath(prompt)
  if (!match) return null
  const ext = match.split('.').pop()?.toLowerCase()
  if (ext === 'pptx') return 'office.read_pptx'
  if (ext === 'docx') return 'office.read_docx'
  if (ext === 'xlsx') return 'office.read_xlsx'
  if (ext === 'pdf') return 'office.read_pdf'
  return null
}

function pickQuery(prompt: string): string {
  if (prompt.includes('品牌')) return '品牌'
  if (prompt.includes('字体')) return '字体'
  return '主色'
}

function pickExpert(prompt: string): string {
  if (prompt.includes('交互') || prompt.includes('流程')) return 'interaction'
  if (prompt.includes('品牌') || prompt.includes('调性')) return 'brand'
  return 'visual'
}

function summarizeResults(results: Message[]): string {
  const texts = results.map((message) => textOf(message)).filter((text) => text.trim() !== '')
  const last = texts[texts.length - 1] ?? '暂无工具结论'
  return last.slice(0, 120)
}

function finalAnswer(prompt: string, results: Message[]): string {
  const bullets = results
    .map((message) => textOf(message).trim())
    .filter((text) => text !== '')
    .map((text) => `- ${text.split('\n')[0]!.slice(0, 80)}`)

  const intro = prompt.trim() === '' ? '方案如下。' : `针对「${prompt.slice(0, 60)}」，方案如下。`
  if (bullets.length === 0) return `${intro}\n没有可用的工具结论，需要补充设计稿或历史决策。`
  return [
    intro,
    ...bullets,
    '下一步：确认主色与层级后进入视觉细化，并把最终决策写入设计记忆。',
  ].join('\n')
}

export function apply(ctx: Context, config: Config = {}): void {
  const router = ctx.require<ModelRouter>('llm')
  const plan = config.plan ?? DEFAULT_PLAN

  ctx.effect(() => router.register(new MockAdapter({ id: 'mock-designer', models: ['mock-design-1'], plan })))
  ctx.effect(() => router.register(new MockAdapter({ id: 'mock-planner', models: ['mock-plan-1'], plan })))

  // Route kinds are a policy, not a model property: the same adapters serve both
  // a planning turn and a design turn.
  ctx.effect(() => router.setPolicy('planning', ['mock-planner', 'mock-designer']))
  ctx.effect(() => router.setPolicy('design', ['mock-designer', 'mock-planner']))
}
