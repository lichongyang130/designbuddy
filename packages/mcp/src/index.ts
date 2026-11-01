import type { ConfigSchema, Context, PluginMeta } from '@designbuddy/core'
import { registerTool } from '@designbuddy/tools'
import type { Tool, ToolsService } from '@designbuddy/tools'
import { McpClient, type McpServerConfig, type McpTool } from './client'

export * from './client'
export { McpClient } from './client'

export const name = 'mcp'
export const inject = ['tools']

export const meta: PluginMeta = {
  title: 'MCP 客户端',
  description: '接入任意 Model Context Protocol 服务器，把它的工具直接注册进 tools 服务。',
  category: 'tool',
  tags: ['mcp', 'integration'],
  order: 36,
}

export const Config: ConfigSchema = [
  {
    key: 'servers',
    label: 'MCP 服务器（JSON 数组）',
    type: 'textarea',
    default: '[]',
    description:
      '每项：{"name":"figma","command":"npx","args":["-y","figma-mcp"],"readOnly":false}。readOnly 为 true 时不触发审批。',
  },
]

/**
 * Namespacing keeps external tools separated from local ones and makes the
 * owner obvious in the prompt and in the UI: `mcp__figma__get_frames`.
 */
export function toolName(server: string, tool: string): string {
  return `mcp__${server}__${tool}`.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

export function apply(ctx: Context, config: { servers?: string }): void {
  const tools = ctx.get<ToolsService>('tools')
  if (!tools) return

  let servers: McpServerConfig[]
  try {
    const parsed = JSON.parse(config.servers || '[]')
    servers = Array.isArray(parsed) ? parsed : []
  } catch (error) {
    ctx.log('error', `MCP 配置不是合法 JSON：${(error as Error).message}`)
    return
  }

  for (const server of servers) {
    if (!server?.name || !server?.command) {
      ctx.log('warn', 'MCP 服务器缺少 name 或 command，已跳过')
      continue
    }
    // Connecting is async and failure must not take the app down: a dead MCP
    // server is a missing capability, not a broken workspace.
    void connect(ctx, tools, server)
  }
}

async function connect(ctx: Context, tools: ToolsService, server: McpServerConfig): Promise<void> {
  let client: McpClient
  let toolList: McpTool[]
  try {
    client = await McpClient.connect(server)
    toolList = await client.listTools()
  } catch (error) {
    ctx.log('error', `MCP 服务器 "${server.name}" 连接失败：${(error as Error).message}`)
    return
  }

  const registered: Tool[] = toolList.map((tool) =>
    registerTool(ctx, {
      name: toolName(server.name, tool.name),
      title: `${server.name} · ${tool.name}`,
      description: `[MCP:${server.name}] ${tool.description ?? tool.name}`,
      scope: server.readOnly ? 'read' : 'write',
      parameters: normalizeSchema(tool.inputSchema),
      handler: async (args) => {
        const result = await client.callTool(tool.name, args)
        if (result.isError) throw new Error(result.text)
        return result.text
      },
    }),
  )

  ctx.log('info', `MCP "${server.name}" 提供 ${registered.length} 个工具`)
  ctx.emit('mcp/connected', {
    server: server.name,
    tools: registered.map((tool) => tool.name),
    description: server.command,
  })

  ctx.effect(() => {
    for (const tool of registered) tools.unregister(tool.name)
    void client.close()
  })
}

/** Some servers omit or flatten the schema; the executor needs an object shape. */
function normalizeSchema(schema: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { type: 'object', properties: {} }
  }
  return { type: 'object', ...schema }
}
