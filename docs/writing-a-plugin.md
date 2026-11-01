# 写一个插件

一个插件就是一个带 `name` 和 `apply` 的对象。不需要继承，不需要注册表，不需要构建期代码生成。

## 最小插件

```ts
import type { Context } from '@designbuddy/core'

export const name = 'hello'

export function apply(ctx: Context): void {
  ctx.log('info', 'hello plugin loaded')
}
```

`Container.apply()` 会调用它，并记住这个 Fork。插件里做的一切都通过 `ctx`，所以都能被干净地卸载。

## 提供一个服务

```ts
export const name = 'counter'

class CounterService {
  private count = 0
  inc() { return ++this.count }
  get() { return this.count }
}

export function apply(ctx: Context): void {
  ctx.set('counter', new CounterService())
}
```

别的插件就能 `ctx.get('counter')`。卸载这个插件，服务立刻从总线上消失。

## 声明依赖

```ts
export const name = 'report'
export const inject = ['sessions', 'counter']

export function apply(ctx: Context, config: { title?: string }): void {
  const sessions = ctx.get('sessions')
  const counter = ctx.get('counter')
  // 两个依赖都存在时，apply 才会被调用。
  // 任何一个被卸载，这个插件自动进入 pending；装回来时自动激活。
}
```

如果依赖是「有则用，无则退」而不是硬依赖，用 `ctx.inject`：

```ts
ctx.inject(['systemPrompt'], (scoped) => {
  const prompt = scoped.get('systemPrompt')
  const remove = prompt.add({ id: 'my-section', order: 35, render: () => '……' })
  scoped.effect(remove)
})
```

## 注册一个工具

工具是模型能调用的能力。**副作用必须有 scope**，执行管线会据此加守卫。

用 `registerTool(ctx, ...)` 而不是 `tools.register(...)`：前者会把工具归属记成**你的插件**，UI 和日志里才不会所有工具都显示成 `tools`。

```ts
export const name = 'tool-jira'
export const inject = ['tools']

export function apply(ctx: Context): void {
  const tools = ctx.get<ToolsService>('tools')

  const tool = registerTool(ctx, {
    name: 'jira.search',
    title: '搜索工单',
    description: '按关键词搜索 Jira 工单，返回标题与状态。',
    scope: 'read',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '搜索词' } },
      required: ['query'],
    },
    async handler(args, run) {
      // run = { sessionId, agent, ctx, signal }
      const response = await fetch(`https://jira.example.com/search?q=${encodeURIComponent(String(args.query))}`)
      return await response.text()      // 返回值是模型看到的文本
    },
  })

  ctx.effect(() => tools.unregister(tool.name))
}
```

模型看到的是 `parameters`（JSON Schema）和 `description`，所以这两项要当产品文案写。

`scope` 决定了 `policy` 插件怎么对待这个工具：`read` 永远放行，`write` 默认需要人确认，`danger` 同 `write` 但在 UI 上标红。写工具时不要图省事标 `read` —— 那等于绕过审批。

守卫在 `ToolsService.execute()` 里执行，模型绕不过去：

```ts
tools.use({
  before: (call) => (call.name === 'fs.write' && readOnly ? '当前处于只读模式' : undefined),
})
```

## 加一个模型

模型只是一个 provider：

```ts
export const name = 'provider-mycorp'
export const inject = ['llm']

export function apply(ctx: Context, config: { apiKey: string }): void {
  const llm = ctx.get('llm')
  const provider = llm.register({
    id: 'mycorp',
    label: 'MyCorp 模型',
    models: [{ id: 'mycorp/chat-1', label: 'chat-1', provider: 'mycorp', contextWindow: 32_000, supportsTools: true }],
    async chat(request) {
      const response = await fetch('https://llm.mycorp.com/v1/chat', { /* ... */ })
      const json = await response.json()
      return { text: json.text, toolCalls: [], finishReason: 'stop' }
    },
    // 可选：实现 stream() 就有流式输出
  })
  ctx.effect(() => llm.unregister(provider.id))
}
```

## 加一个专家

专家是数据。新增一位专家不需要改循环，也不需要改提示词模板：

```ts
export const name = 'my-experts'
export const inject = ['agents']

export function apply(ctx: Context): void {
  const agents = ctx.get('agents')
  const expert = agents.register({
    name: 'a11y',
    title: '无障碍专家',
    description: '检查对比度、键盘可达性与屏幕阅读器语义。',
    tools: ['fs.read', 'skill.read'],
    instructions: '你只关注可访问性，输出必须包含具体对比度数值与键盘操作路径。',
  })
  ctx.effect(() => agents.unregister(expert.name))
}
```

`tools` 是 allowlist：不在列表里的工具，模型在提示词里根本看不到。

## 加一个技能

技能是 Markdown 文件，不需要写代码：

```md
---
name: contrast-check
title: 对比度检查
description: 用 WCAG AA 标准检查文字与背景的对比度。
---

# 对比度检查
1. 正文与背景对比度 ≥ 4.5:1
2. 大字（18px 粗体 / 24px 常规）≥ 3:1
...
```

放进 `skills/` 目录即生效。系统提示词里只出现名字和描述，模型真需要时才用 `skill.read` 打开全文 —— 这是控制 token 成本的关键。

## 接入清单

1. `packages/<name>/package.json`（依赖 `@designbuddy/core` 以及需要 inject 的包）
2. `packages/<name>/tsconfig.json`（extends 根配置，references 依赖包）
3. `packages/<name>/src/index.ts`（导出 `name` / `inject` / `Config` / `meta` / `apply`）
4. 在 `apps/server/src/registry.ts` 加一行
5. `npm run build`

写测试时不要手搭插件图，直接 `createApplication({ serve: false })` 用真实组合 —— 这样才能测到"卸载 memory 之后提示词里真的没有记忆了"这类行为。
