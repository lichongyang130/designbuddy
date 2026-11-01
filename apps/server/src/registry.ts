import * as agents from '@designbuddy/agents'
import * as core from '@designbuddy/core'
import * as host from '@designbuddy/host'
import * as llm from '@designbuddy/llm'
import * as memory from '@designbuddy/memory'
import * as modelMock from '@designbuddy/model-mock'
import * as plan from '@designbuddy/plan'
import * as policy from '@designbuddy/policy'
import * as presets from '@designbuddy/presets'
import * as providerOpenai from '@designbuddy/provider-openai'
import * as session from '@designbuddy/session'
import * as skills from '@designbuddy/skills'
import * as systemPrompt from '@designbuddy/system-prompt'
import * as toolAgent from '@designbuddy/tool-agent'
import * as toolFs from '@designbuddy/tool-fs'
import * as toolMemory from '@designbuddy/tool-memory'
import * as toolPlan from '@designbuddy/tool-plan'
import * as toolSkill from '@designbuddy/tool-skill'
import * as tools from '@designbuddy/tools'
import * as workspace from '@designbuddy/workspace'
import type { MarketEntry } from '@designbuddy/host'

/**
 * The composition root.
 *
 * Order is the dependency order, but it does not strictly matter: a plugin
 * whose injections are not ready yet stays `pending` and is activated the moment
 * its dependencies appear. That is what makes the market list editable at
 * runtime instead of at boot.
 */
export const market: MarketEntry[] = [
  { plugin: llm, required: true, defaultConfig: {} },
  { plugin: session, required: true, defaultConfig: { dir: '.data/sessions' } },
  { plugin: tools, required: true },
  { plugin: systemPrompt, required: true },
  { plugin: agents, required: true, defaultConfig: { maxSteps: 6, maxHistoryChars: 24000 } },
  { plugin: presets, required: true },

  { plugin: workspace, required: true, defaultConfig: { root: 'workspace' } },
  { plugin: memory, defaultConfig: { file: '.data/memory.json' } },
  { plugin: plan },
  {
    plugin: policy,
    defaultConfig: { mode: 'approve-writes', allow: 'plan.*', timeout: 180 },
  },
  { plugin: skills, defaultConfig: { dir: 'skills' } },

  { plugin: modelMock },
  { plugin: providerOpenai, defaultConfig: { baseUrl: 'https://api.openai.com/v1', models: 'gpt-4o-mini' } },

  { plugin: toolFs },
  { plugin: toolMemory },
  { plugin: toolPlan },
  { plugin: toolSkill },
  { plugin: toolAgent },
]

export { core, host }
