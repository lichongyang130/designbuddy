/**
 * `modelRuntime` 插件 —— 让「设置 → 模型」里存的东西**立刻**变成运行时可用的适配器。
 *
 * 以前适配器只在启动时按环境变量挂一次，设置页保存成功、测试连接也通过，但对话还走老模型：
 * 用户以为接上了，其实没有。这里把那份「配置意图」对齐成「实际挂载」，并且：
 *
 *   - `sync()` 幂等：先撤上一次挂的，再按当前清单重挂，所以可以随便调；
 *   - 链尾永远留 `mock-*`：Key 写错、断网、限流都不会把一次生成炸掉，只会降级；
 *   - 不碰磁盘：读 `models.json` + `models.keys.json`，只在内存里对齐。
 *
 * @module designbuddy/plugins/model-runtime
 */

import type { Context, Disposer } from '../kernel/index.ts'
import { ModelRouter } from '../core/router.ts'
import { ModelCatalog } from '../core/models.ts'
import type { MountPlan, MountEntry } from '../core/model-runtime.ts'
import { chainFor, planMounts } from '../core/model-runtime.ts'
import { OpenAiAdapter } from './openai-llm.ts'

export const name = 'modelRuntime'

export const inject = ['llm', 'models']

const KINDS = ['planning', 'design', 'copy', 'review'] as const

export interface RuntimeStatus {
  mounted: { id: string; adapterId: string; name: string; model: string; baseUrl: string }[]
  skipped: MountPlan['skipped']
  chain: string[]
  /** 链上是否有真模型（mock 不算）。 */
  live: boolean
  syncedAt: number
}

export class ModelRuntime {
  #router: ModelRouter
  #catalog: ModelCatalog
  #mounts: Disposer[] = []
  #policies: Disposer[] = []
  #signature = ''
  #status: RuntimeStatus = { mounted: [], skipped: [], chain: [], live: false, syncedAt: 0 }
  #log: (message: string) => void

  constructor(options: { router: ModelRouter; catalog: ModelCatalog; log?: (message: string) => void }) {
    this.#router = options.router
    this.#catalog = options.catalog
    this.#log = options.log ?? (() => {})
  }

  status(): RuntimeStatus {
    return this.#status
  }

  /** 幂等对齐：清单没变就直接返回，变了就重挂。 */
  sync(force = false): RuntimeStatus {
    const plan = planMounts({ models: this.#catalog.list(), keyOf: (id) => this.#catalog.key(id) })
    if (!force && plan.signature === this.#signature) return this.#status

    for (const dispose of this.#mounts.splice(0)) dispose()
    const mounted: RuntimeStatus['mounted'] = []
    for (const mount of plan.mounts) {
      try {
        this.#mount(mount)
        mounted.push({
          id: mount.id,
          adapterId: mount.adapterId,
          name: mount.name,
          model: mount.model,
          baseUrl: mount.baseUrl,
        })
      } catch (error) {
        plan.skipped.push({
          id: mount.id,
          name: mount.name,
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }

    let chain: string[] = []
    for (const dispose of this.#policies.splice(0)) dispose()
    for (const kind of KINDS) {
      const candidates = chainFor(plan, kind)
      if (kind === 'planning') chain = candidates
      // 直接 register 而不是 ctx.effect：这份策略要能被下一次 sync 换掉。
      this.#policies.push(this.#router.setPolicy(kind, candidates))
    }

    this.#signature = plan.signature
    this.#status = {
      mounted,
      skipped: plan.skipped,
      chain,
      live: this.#router.candidatesFor('planning').some((id) => !id.startsWith('mock')),
      syncedAt: Date.now(),
    }
    this.#log(
      `model runtime: ${mounted.length} 个模型已挂载` +
        (plan.skipped.length > 0 ? `，跳过 ${plan.skipped.length} 个` : '') +
        `，链 ${chain.join(' → ')}`,
    )
    return this.#status
  }

  dispose(): void {
    for (const dispose of this.#mounts.splice(0)) dispose()
    for (const dispose of this.#policies.splice(0)) dispose()
    this.#signature = ''
  }

  #mount(mount: MountEntry): void {
    const adapter = new OpenAiAdapter({
      id: mount.adapterId,
      baseUrl: mount.baseUrl,
      apiKey: mount.apiKey,
      models: [mount.model],
    })
    this.#mounts.push(this.#router.register(adapter))
  }
}

export function apply(ctx: Context): Disposer {
  const router = ctx.require<ModelRouter>('llm')
  const catalog = ctx.require<ModelCatalog>('models')
  const runtime = new ModelRuntime({ router, catalog, log: (message) => ctx.logger.info(message) })
  ctx.provide('modelRuntime', runtime)
  // 启动时对齐一次：环境变量里配了的、设置里存过的，开机就能用。
  runtime.sync()
  return () => runtime.dispose()
}
