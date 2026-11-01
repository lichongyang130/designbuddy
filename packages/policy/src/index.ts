import type { ConfigSchema, Context, PluginMeta } from '@designbuddy/core'
import type { ToolsService } from '@designbuddy/tools'
import { PolicyService, type PolicyMode } from './service'

export * from './service'
export { PolicyService } from './service'

export const name = 'policy'
export const inject = ['tools']

export const meta: PluginMeta = {
  title: '副作用策略',
  description: '读操作放行，写操作需要人确认；也可以一键切成只读。拦截发生在执行器里，模型绕不过去。',
  category: 'core',
  tags: ['policy', 'guard', 'approval'],
  order: 14,
}

export const Config: ConfigSchema = [
  {
    key: 'mode',
    label: '模式',
    type: 'select',
    default: 'approve-writes',
    options: [
      { label: '写操作需确认', value: 'approve-writes' },
      { label: '只读（禁止一切写入）', value: 'readonly' },
      { label: '自动放行', value: 'auto' },
    ],
    description: '读工具（fs.list / fs.read / memory.search）在任何模式下都不会被拦。',
  },
  {
    key: 'allow',
    label: '免确认工具',
    type: 'string',
    default: 'plan.*',
    description: '逗号分隔，支持 * 结尾前缀匹配。这类工具只改会话内状态，不触碰外部世界。',
  },
  {
    key: 'timeout',
    label: '确认超时（秒）',
    type: 'number',
    default: 180,
    description: '超时未确认按拒绝处理，模型会收到"用户没有批准"。',
  },
]

export function apply(
  ctx: Context,
  config: { mode?: PolicyMode; timeout?: number; allow?: string },
): void {
  const tools = ctx.get<ToolsService>('tools')
  if (!tools) return

  const service = new PolicyService(
    ctx,
    tools,
    config.mode ?? 'approve-writes',
    Math.max(5, Number(config.timeout ?? 180)) * 1000,
    (config.allow ?? 'plan.*')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  ctx.set('policy', service)
  tools.use(service.guard())
  ctx.log('info', `policy mode = ${service.mode}`)
}

export default PolicyService
