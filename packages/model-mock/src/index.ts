import type { Context, PluginMeta } from '@designbuddy/core'
import type { AssistantTurn, ChatMessage, ChatRequest, LlmChunk, LlmProvider, ToolCall } from '@designbuddy/llm'

export const name = 'model-mock'
export const inject = ['llm']

export const meta: PluginMeta = {
  title: '离线示例模型',
  description: '不需要 API key 的规则模型：用于本地演示工具调用与流式输出。',
  category: 'model',
  tags: ['mock', 'offline'],
  order: 25,
}

const MODEL = {
  id: 'mock/designer',
  label: '离线示例模型 · designer',
  provider: 'mock',
  contextWindow: 32_000,
  supportsTools: true,
}

/**
 * A deterministic provider good enough to demo the machinery: it streams text,
 * emits real tool calls and reads tool results on the next step. Swap it out by
 * loading @designbuddy/provider-openai instead — nothing else changes.
 */
function createMockProvider(): LlmProvider {
  return {
    id: 'mock',
    label: '离线示例',
    models: [MODEL],
    async chat(request) {
      return complete(request)
    },
    async *stream(request): AsyncIterable<LlmChunk> {
      const turn = complete(request)
      const chunks = splitForStreaming(turn.text)
      for (const chunk of chunks) {
        await sleep(12)
        yield { type: 'text', text: chunk }
      }
      for (const call of turn.toolCalls) yield { type: 'tool_call', call }
      if (turn.usage) yield { type: 'usage', usage: turn.usage }
    },
  }
}

function complete(request: ChatRequest): AssistantTurn {
  const lastUserIndex = findLastIndex(request.messages, (message) => message.role === 'user')
  const lastUser = lastUserIndex >= 0 ? request.messages[lastUserIndex] : undefined
  const sinceUser = lastUserIndex >= 0 ? request.messages.slice(lastUserIndex + 1) : []
  const toolResults = sinceUser.filter((message) => message.role === 'tool')
  const available = new Set((request.tools ?? []).map((tool) => tool.name))
  const text = (lastUser?.content ?? '').trim()

  if (!toolResults.length) {
    const call = planToolCall(text, available)
    if (call) {
      return {
        text: '',
        toolCalls: [call],
        finishReason: 'tool_calls',
        usage: { inputTokens: estimate(request.messages), outputTokens: 20 },
      }
    }
  }

  const answer = composeAnswer(text, toolResults, available)
  return {
    text: answer,
    toolCalls: [],
    finishReason: 'stop',
    usage: { inputTokens: estimate(request.messages), outputTokens: answer.length },
  }
}

function planToolCall(text: string, available: Set<string>): ToolCall | null {
  const wantsProject = /(项目|文件|工作区|现状|看看|读一下|review 一下|评审一下)/.test(text)
  const wantsPlan = /(计划|步骤|怎么开始|拆解|分几步|规划)/.test(text)
  const wantsRemember = /(记住|记一下|记下)/.test(text)
  const wantsExternal = /(评审|review|记录|外部|MCP)/i.test(text)
  const external = [...available].find((name) => name.startsWith('mcp__'))

  if (wantsRemember && available.has('memory.save')) {
    return {
      id: `call_${Math.random().toString(36).slice(2, 8)}`,
      name: 'memory.save',
      arguments: {
        text: text.replace(/^(请)?(你)?(帮我)?(记住|记一下|记下)[:：,，\s]*/, '').slice(0, 120),
        kind: 'decision',
        tags: ['from-demo'],
      },
    }
  }
  if (wantsExternal && external) {
    return {
      id: `call_${Math.random().toString(36).slice(2, 8)}`,
      name: external,
      arguments: { limit: 5 },
    }
  }
  if (wantsPlan && available.has('plan.write')) {
    return {
      id: `call_${Math.random().toString(36).slice(2, 8)}`,
      name: 'plan.write',
      arguments: {
        items: [
          '澄清目标用户与核心场景',
          '盘点现有项目材料，找出证据与缺口',
          '给出一个推荐方案 + 一个备选方案',
          '列出需要用户拍板的决策点',
        ],
      },
    }
  }
  if (wantsProject && available.has('fs.list')) {
    return {
      id: `call_${Math.random().toString(36).slice(2, 8)}`,
      name: 'fs.list',
      arguments: { path: '.', recursive: true },
    }
  }
  return null
}

function composeAnswer(userText: string, toolResults: ChatMessage[], available: Set<string>): string {
  const topic = userText.replace(/\s+/g, ' ').slice(0, 60) || '这个需求'
  const evidence = toolResults
    .map((message) => `- \`${message.name ?? 'tool'}\` → ${truncate(message.content, 320)}`)
    .join('\n')

  if (toolResults.length) {
    return `已经看过项目里的材料了，下面是我基于实际文件给出的判断。

**查到的事实**
${evidence}

**我读到的信号**
1. 现有材料里最缺的是"用户证据"——目前写的是设计意图，不是用户行为。
2. 品牌与语气描述已经比较明确，可以直接往交互层落。

**建议的下一步**
- 先补 3 条真实用户场景（谁、什么情境、现在怎么绕过）。
- 按上面的事实写一版主流程，再让 critic 挑刺。

（本轮由**离线示例模型**生成，用于演示工具调用链路；配置 openai 兼容模型后回答会来自真实模型。）`
  }

  return `收到：${topic}

我先按设计问题来拆，而不是直接给方案。

**1. 需要确认的关键点**
- 这次要解决的是"用户不会用"，还是"用户不愿意用"？两者的设计动作完全不同。
- 有没有一个可衡量的成功标准（完成任务时长、放弃率、返工次数）？

**2. 我的初步判断**
${guessDirection(topic)}

**3. 建议的执行顺序**
1. 写下目标用户与场景，一句话各一条。
2. 把现有流程画成编号步骤，标出用户可能放弃的位置。
3. 只改最关键的一个断点，验证后再扩展。

${available.has('plan.write') ? '如果需要，我可以把上面几步写成计划并逐步推进（说"拆解一下"即可）。' : ''}

（本轮由**离线示例模型**生成，用于演示插件链路；换上真实模型即可获得真实回答。）`
}

function guessDirection(topic: string): string {
  if (/(B端|后台|管理|企业)/.test(topic)) {
    return '这类需求通常不是界面问题，而是信息密度与权限模型的问题。先把角色、可见信息、可执行操作列成矩阵，界面会自然收敛。'
  }
  if (/(品牌|视觉|风格|logo|配色)/.test(topic)) {
    return '先定"想让用户产生什么感受"，再定字号与色彩数值。没有意图的视觉方案无法验收，也无法维护。'
  }
  if (/(流程|步骤|操作|交互)/.test(topic)) {
    return '先把状态列全（空、加载、部分成功、失败、无权限），大多数体验问题是漏掉状态，而不是步骤本身太长。'
  }
  return '先把问题写成一句可验证的假设，再决定用什么方案验证它。方案的价值在于能推翻假设，而不在于好看。'
}

function truncate(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat
}

function splitForStreaming(text: string): string[] {
  const chunks: string[] = []
  let index = 0
  const size = 14
  while (index < text.length) {
    chunks.push(text.slice(index, index + size))
    index += size
  }
  return chunks
}

function estimate(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0)
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index--) {
    if (predicate(items[index])) return index
  }
  return -1
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function apply(ctx: Context): void {
  const llm = ctx.get<{ register(provider: LlmProvider): LlmProvider }>('llm')
  if (!llm) return
  const provider = llm.register(createMockProvider())
  ctx.effect(() => {
    ctx.get<any>('llm')?.unregister(provider.id)
  })
}
