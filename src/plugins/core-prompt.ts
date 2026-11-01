/**
 * `systemPrompt` core plugin — provides `ctx.get('systemPrompt')`.
 *
 * DSH equivalent: `packages/core/system-prompt` (`ctx.systemPrompt`).
 *
 * @module designbuddy/plugins/core-prompt
 */

import type { Context } from '../kernel/index.ts'
import { SystemPromptService } from '../core/prompt.ts'

export const name = 'systemPrompt'

export function apply(ctx: Context): void {
  const prompt = new SystemPromptService()

  // The one section every DesignBuddy agent needs. Product plugins add the rest.
  prompt.add({
    id: 'core/identity',
    order: 10,
    render: () =>
      [
        '你是 DesignBuddy 的设计协作助手，运行在一个插件化的 Agent 框架里。',
        '你能看到的工具来自当前已装载的插件；工具不存在就说明该能力未安装，不要假装调用。',
        '回答使用简体中文，先给结论再给理由。',
      ].join('\n'),
  })

  ctx.provide('systemPrompt', prompt)
}
