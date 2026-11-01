import type { Context } from '@designbuddy/core'
import { ToolsService } from './service'
import type { Tool } from './types'

export * from './types'
export { ToolsService } from './service'

export const name = 'tools'

/**
 * Registers a tool on behalf of the calling plugin.
 *
 * Attribution matters: the UI and the logs say who owns a tool, and the
 * registry must not credit every tool to the `tools` plugin itself.
 */
export function registerTool(ctx: Context, tool: Tool): Tool {
  const tools = ctx.get<ToolsService>('tools')
  if (!tools) throw new Error('tools service is not loaded')
  return tools.register(tool, ctx.fork?.name ?? 'root')
}

export function apply(ctx: Context): void {
  ctx.set('tools', new ToolsService(ctx))
}

export default ToolsService
