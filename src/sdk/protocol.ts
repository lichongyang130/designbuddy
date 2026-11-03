/**
 * SDK protocol — the wire contract between Host and Client.
 *
 * DSH equivalent: `packages/sdk/protocol`, consumed by `sdk/server`,
 * `sdk/client` and the JSON-RPC server in `packages/bundle/sdk-app`. The shape is
 * deliberately boring: request/response frames plus a one-way event stream, so
 * a client can be a web app, a CLI, or an Electron renderer without knowing
 * anything about the kernel.
 *
 * Platform note: this module imports nothing from `node:*`. Transports live at
 * the edges (`apps/host/main.ts` uses stdio), which keeps the protocol usable
 * from a browser bundle.
 *
 * @module designbuddy/sdk/protocol
 */

import type { Disposer } from '../kernel/index.ts'
import type { AgentEvent } from '../core/agent.ts'
import type { SessionEvent } from '../core/session.ts'
import type { ApprovalRequest } from '../core/approvals.ts'

export type ClientMethod =
  | 'session.create'
  | 'session.list'
  | 'session.events'
  | 'agent.run'
  | 'tools.list'
  | 'presets.list'
  | 'plugins.tree'
  | 'plugins.rows'
  | 'plugins.unmount'
  | 'memory.list'
  | 'memory.save'
  | 'session.export'
  | 'router.status'
  | 'models.list'
  | 'models.save'
  | 'models.remove'
  | 'models.test'
  | 'office.run'
  | 'approvals.respond'

export interface ClientFrame {
  id: string
  method: ClientMethod
  params?: Record<string, unknown>
}

/** Durable facts, forwarded as they are appended to the session log. */
export interface EventFrame {
  type: 'event'
  sessionId: string
  event: SessionEvent
}

/** Live agent activity, forwarded as the loop produces it. */
export interface AgentEventFrame {
  type: 'agent-event'
  sessionId: string
  event: AgentEvent
}

/**
 * A write tool is parked, waiting for a human. The client renders one card and
 * answers with `approvals.respond`; silence means refusal.
 */
export interface ApprovalFrame {
  type: 'approval.request'
  sessionId: string
  request: ApprovalRequest
}

export type HostFrame =
  | { type: 'rpc.result'; id: string; result: unknown }
  | { type: 'rpc.error'; id: string; message: string }
  | EventFrame
  | AgentEventFrame
  | ApprovalFrame

/** Anything that can carry frames in both directions. */
export interface Transport {
  send(frame: ClientFrame | HostFrame): void
  onFrame(handler: (frame: any) => void): Disposer
}

interface Endpoint {
  handlers: Set<(frame: any) => void>
  send: (frame: any) => void
  onFrame: (handler: (frame: any) => void) => Disposer
}

function createEndpoint(): Endpoint {
  const handlers = new Set<(frame: any) => void>()
  return {
    handlers,
    send: () => {},
    onFrame: (handler) => {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
  }
}

/**
 * In-process transport pair: what tests and the single-process demo use.
 *
 * Delivery is queued on a microtask so a client cannot observe a reply before
 * `request()` has returned its promise — the same ordering a real socket gives.
 */
export function createLoopback(): { client: Transport; host: Transport } {
  const client = createEndpoint()
  const host = createEndpoint()

  const deliver = (target: Endpoint, frame: any) => {
    queueMicrotask(() => {
      for (const handler of [...target.handlers]) handler(frame)
    })
  }

  client.send = (frame) => deliver(host, frame)
  host.send = (frame) => deliver(client, frame)

  return {
    client: { send: client.send, onFrame: client.onFrame },
    host: { send: host.send, onFrame: host.onFrame },
  }
}
