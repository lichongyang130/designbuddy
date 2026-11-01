/**
 * The DesignBuddy composition — this file is DesignBuddy's `dsh-base` bundle.
 *
 * DSH equivalent: `packages/bundle/base` (`dsh-base`) is the shared first layer
 * for the web / headless / sdk / acp profiles. Same idea here: one base bundle
 * that every DesignBuddy surface (desktop, web, CLI) stacks on, plus optional
 * bundles a profile can add.
 *
 * To port this into your existing repo: keep the bundles, replace `defaultModules`
 * with your own module map, and leave the kernel untouched.
 *
 * @module designbuddy/boot/profiles
 */

import type { PluginModules } from './app.ts'
import type { Bundle, Profile } from './loader.ts'

import * as coreTools from '../plugins/core-tools.ts'
import * as coreLlm from '../plugins/core-llm.ts'
import * as coreSession from '../plugins/core-session.ts'
import * as corePrompt from '../plugins/core-prompt.ts'
import * as coreAgent from '../plugins/core-agent.ts'
import * as coreAgentLoop from '../plugins/core-agent-loop.ts'
import * as mockLlm from '../plugins/mock-llm.ts'
import * as designMemory from '../plugins/design-memory.ts'
import * as designExperts from '../plugins/design-experts.ts'
import * as connectorFigma from '../plugins/connector-figma.ts'
import * as officeTools from '../plugins/office-tools.ts'

/**
 * Base layer. Everything a DesignBuddy surface needs and nothing it does not.
 * Order is irrelevant to correctness — `inject` handles that — but it is kept
 * producer-first so the boot tree reads like the dependency graph.
 */
export const coreBundle: Bundle = {
  name: 'core',
  rows: [
    { id: 'core.tools', plugin: 'core-tools' },
    { id: 'core.llm', plugin: 'core-llm', config: { logRouting: false } },
    { id: 'core.sessions', plugin: 'core-session' },
    { id: 'core.prompt', plugin: 'core-prompt' },
    { id: 'core.agents', plugin: 'core-agent' },
    { id: 'core.agentLoop', plugin: 'core-agent-loop' },
  ],
}

/** Model adapters. Swap `mock-llm` for `deepseek` and nothing else changes. */
export const modelBundle: Bundle = {
  name: 'models',
  rows: [{ id: 'models.mock', plugin: 'mock-llm' }],
}

/** The DesignBuddy product layer. */
export const designBundle: Bundle = {
  name: 'design',
  rows: [
    {
      id: 'design.memory',
      plugin: 'design-memory',
      config: {
        promptLimit: 5,
        seed: [
          { topic: '主色', content: '品牌主色 #1F6FEB，禁止用于大面积背景' },
          { topic: '圆角', content: '统一 8px，卡片 12px' },
        ],
      },
    },
    { id: 'design.experts', plugin: 'design-experts' },
    { id: 'design.figma', plugin: 'connector-figma', config: { fileKey: 'demo-file' } },
    { id: 'office.tools', plugin: 'office-tools' },
  ],
}

export const desktopProfile: Profile = {
  name: 'desktop',
  bundles: [coreBundle, modelBundle, designBundle],
}

/** A headless profile is the same composition minus the connector. */
export const headlessProfile: Profile = {
  name: 'headless',
  bundles: [coreBundle, modelBundle],
}

export const defaultModules: PluginModules = {
  'core-tools': coreTools,
  'core-llm': coreLlm,
  'core-session': coreSession,
  'core-prompt': corePrompt,
  'core-agent': coreAgent,
  'core-agent-loop': coreAgentLoop,
  'mock-llm': mockLlm,
  'design-memory': designMemory,
  'design-experts': designExperts,
  'connector-figma': connectorFigma,
  'office-tools': officeTools,
}
