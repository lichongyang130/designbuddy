/**
 * `connector-figma` — an external connector as a plugin.
 *
 * DSH equivalent: `mcp/mcp-client` and `web/web-search-*`. The pattern is always
 * the same: a connector plugin injects the services it needs and contributes
 * tools. Nothing in the core knows Figma exists.
 *
 * This one is a stub on purpose — the network call is replaced by fixture data so
 * the demo runs offline. Swap `#fetchFrame` for a real Figma API call and no
 * other file changes.
 *
 * @module designbuddy/plugins/connector-figma
 */

import type { Context } from '../kernel/index.ts'
import type { DesignMemoryService } from './design-memory.ts'
import type { JsonSchema } from '../core/schema.ts'
import type { ToolRegistry } from '../core/tools.ts'

export const name = 'figma'

export const inject = ['tools', 'designMemory']

export interface Config {
  /** Figma file key. Only used for the fixture lookup in this stub. */
  fileKey?: string
  /** Persist inspected tokens into design memory. */
  rememberTokens?: boolean
}

const frameSchema: JsonSchema = {
  type: 'object',
  properties: {
    frameId: { type: 'string', description: '要读取的 Figma frame id' },
  },
  required: ['frameId'],
}

interface FrameSnapshot {
  frameId: string
  name: string
  tokens: Record<string, string>
  notes: string[]
}

const FIXTURES: Record<string, FrameSnapshot> = {
  'home-hero': {
    frameId: 'home-hero',
    name: '首页 Hero',
    tokens: {
      'color.primary': '#1F6FEB',
      'color.surface': '#0B1220',
      'font.heading': 'Inter 32/40 Semibold',
      'font.body': 'Inter 16/24 Regular',
      'spacing.gutter': '24px',
    },
    notes: ['主 CTA 对比度 4.6:1，低于 AA 大字号阈值', '标题与正文只差 2 级，层级偏弱'],
  },
}

export function apply(ctx: Context, config: Config = {}): void {
  const memory = ctx.require<DesignMemoryService>('designMemory')
  const tools = ctx.require<ToolRegistry>('tools')

  const fetchFrame = async (frameId: string): Promise<FrameSnapshot | null> => {
    // Fixture lookup. In production this is `GET /v1/files/:key/nodes` against
    // the Figma API with a credential resolved from the `credentials` service.
    return FIXTURES[frameId] ?? null
  }

  ctx.effect(() =>
    tools.register({
      name: 'figma.inspect_frame',
      description: '读取 Figma frame 的设计 token 与自动检查备注',
      parameters: frameSchema,
      timeoutMs: 15_000,
      execute: async (args) => {
        const frameId = String(args.frameId)
        const frame = await fetchFrame(frameId)
        if (!frame) return { content: `未找到 frame "${frameId}"`, isError: true }

        if (config.rememberTokens !== false) {
          memory.save(`frame:${frame.frameId}`, `${frame.name} 主色 ${frame.tokens['color.primary']}`)
        }

        const tokens = Object.entries(frame.tokens)
          .map(([key, value]) => `  ${key} = ${value}`)
          .join('\n')
        const notes = frame.notes.map((note) => `  - ${note}`).join('\n')
        return `frame ${frame.name} (${frame.frameId})\ntokens:\n${tokens}\n自动检查:\n${notes}`
      },
    }),
  )

  ctx.logger.debug(`figma connector mounted for file ${config.fileKey ?? '(fixture)'}`)
}
