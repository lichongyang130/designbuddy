#!/usr/bin/env node
/**
 * Host process — the execution side, speaking JSONL over stdio.
 *
 * This is the file that makes the Host/Client split real rather than notional:
 * the client below it starts with `spawn`, not `import`. DSH's equivalent is
 * `packages/host/webserver` behind `packages/sdk/server`, except there the
 * transport is a socket.
 *
 * Protocol: one JSON frame per line on stdin, one per line on stdout.
 * Diagnostics go to stderr so they never corrupt the frame stream.
 */

import { createInterface } from 'node:readline'

import { App } from '../../src/boot/app.ts'
import { defaultModules, desktopProfile } from '../../src/boot/profiles.ts'
import { Logger } from '../../src/kernel/index.ts'
import { HostServer } from '../../src/sdk/host.ts'
import type { Transport } from '../../src/sdk/protocol.ts'

const logger = new Logger(process.env.DSH_DEBUG ? 'debug' : 'warn')
const app = await App.create({ profile: desktopProfile, modules: defaultModules, logger })

const transport: Transport = {
  send(frame) {
    process.stdout.write(`${JSON.stringify(frame)}\n`)
  },
  onFrame(handler) {
    const lines = createInterface({ input: process.stdin })
    lines.on('line', (line) => {
      const trimmed = line.trim()
      if (trimmed === '') return
      try {
        handler(JSON.parse(trimmed))
      } catch (error) {
        logger.error('dropped malformed frame', (error as Error).message)
      }
    })
    return () => lines.close()
  },
}

const server = new HostServer(app.ctx, transport)

process.stderr.write(`host ready: ${app.rows.length} rows\n`)

let shuttingDown = false
const shutdown = async () => {
  if (shuttingDown) return
  shuttingDown = true
  server.dispose()
  await app.dispose()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.stdin.on('close', () => void shutdown())
