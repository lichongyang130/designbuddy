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
import * as coreUsage from '../plugins/core-usage.ts'
import * as coreLibrary from '../plugins/core-library.ts'
import * as coreModels from '../plugins/core-models.ts'
import * as corePrompt from '../plugins/core-prompt.ts'
import * as coreAgent from '../plugins/core-agent.ts'
import * as coreAgentLoop from '../plugins/core-agent-loop.ts'
import * as mockLlm from '../plugins/mock-llm.ts'
import * as openaiLlm from '../plugins/openai-llm.ts'
import * as modelRuntime from '../plugins/model-runtime.ts'
import * as browserRelay from '../plugins/browser-relay.ts'
import * as designMemory from '../plugins/design-memory.ts'
import * as designExperts from '../plugins/design-experts.ts'
import * as connectorFigma from '../plugins/connector-figma.ts'
import * as connectorHub from '../plugins/connector-hub.ts'
import * as approvals from '../plugins/approvals.ts'
import * as deckEngine from '../plugins/deck-engine.ts'
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
    { id: 'core.usage', plugin: 'core-usage' },
    { id: 'core.library', plugin: 'core-library' },
    { id: 'core.models', plugin: 'core-models' },
    { id: 'core.prompt', plugin: 'core-prompt' },
    { id: 'core.agents', plugin: 'core-agent' },
    { id: 'core.agentLoop', plugin: 'core-agent-loop' },
  ],
}

/**
 * Model adapters.
 *
 * 三行都要挂，顺序就是优先级：
 *   1. `mock-llm` **永远在**——它是链尾兜底，不是「没配 Key 时的替代品」。
 *      以前是二选一，结果 Key 一写错整个演示就炸；
 *   2. `openai-llm` 读环境变量三件套（`DB_LLM_API_KEY` / `_BASE_URL` / `_MODEL`），
 *      没配 Key 时它自己 `return`，不占位置；
 *   3. `model-runtime` 把「设置 → 模型」里存的条目实时挂上来，保存即生效、删掉即撤销。
 */
export const modelBundle: Bundle = {
  name: 'models',
  rows: [
    { id: 'models.mock', plugin: 'mock-llm' },
    { id: 'models.openai', plugin: 'openai-llm' },
    { id: 'models.relay', plugin: 'browser-relay' },
    { id: 'models.runtime', plugin: 'model-runtime' },
  ],
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
    { id: 'design.approvals', plugin: 'approvals' },
    { id: 'design.decks', plugin: 'deck-engine' },
    { id: 'design.connectors', plugin: 'connector-hub' },
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
  'core-usage': coreUsage,
  'core-library': coreLibrary,
  'core-models': coreModels,
  'core-prompt': corePrompt,
  'core-agent': coreAgent,
  'core-agent-loop': coreAgentLoop,
  'mock-llm': mockLlm,
  'openai-llm': openaiLlm,
  'model-runtime': modelRuntime,
  'browser-relay': browserRelay,
  'design-memory': designMemory,
  'design-experts': designExperts,
  'connector-figma': connectorFigma,
  'connector-hub': connectorHub,
  approvals,
  'deck-engine': deckEngine,
  'office-tools': officeTools,
}
