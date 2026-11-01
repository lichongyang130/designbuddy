import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApplication, type App } from '../app'

/**
 * Boots the real composition on a throwaway data directory.
 *
 * Tests must never share `.data` or `workspace` — session and memory plugins
 * persist to disk by design, so isolation belongs to the harness.
 */
export function bootTestApp(): { app: App; ctx: App['ctx']; dispose: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'designbuddy-test-'))
  const app = createApplication({
    serve: false,
    dataDir: join(dir, 'data'),
    workspaceDir: join(dir, 'workspace'),
  })
  return {
    app,
    ctx: app.ctx,
    dispose: () => {
      app.stop()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

export async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}
