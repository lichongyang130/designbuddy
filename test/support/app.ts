/**
 * Test harness: boot the real profile, not a mock of it.
 *
 * The point of testing through `App.create` is that plugin wiring, `inject`
 * ordering and teardown are exactly the production code paths. A test that
 * builds its own context can pass while the shipped composition is broken.
 */

import { App } from '../../src/boot/app.ts'
import type { Bundle, Profile } from '../../src/boot/loader.ts'
import { coreBundle, defaultModules, modelBundle } from '../../src/boot/profiles.ts'
import { Logger } from '../../src/kernel/index.ts'
import type { ToolCallContext } from '../../src/core/tools.ts'

export async function boot(extra: Bundle[] = []): Promise<App> {
  const profile: Profile = { name: 'test', bundles: [coreBundle, modelBundle, ...extra] }
  return App.create({
    profile,
    modules: defaultModules,
    logger: new Logger('silent'),
  })
}

export const toolCallContext: ToolCallContext = {
  sessionId: 'sess-test',
  agentId: 'agent-test',
  callId: 'call-test',
}
