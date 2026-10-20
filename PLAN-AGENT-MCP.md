# Phase 2: Agent-Driven Workflow & Handoff Integration

## 1. Planning
**Goal**: Complete the core MCP interactive capabilities by enabling "AI Remix" and "Export/Handoff" workflows in the Prototype (原型) viewer, bridging the frontend to the `agent-daemon` and `mcp-os-daemon`.
**Tasks**:
1. Implement a unified `useAgentConnection.ts` hook in the frontend to subscribe to the EventSource endpoint at `http://0.0.0.0:4124/events`.
2. Map incoming Server-Sent Events (`buddy:agent-update-data`, `buddy:run-skill`) to local UI state changes.
3. Wire up the four Action Buttons in `GenericPrototype.tsx`:
   - `Clone`: Save a new duplicate in localStorage (native implementation).
   - `AI Remix`: Mutate `aiSeed` to trigger a simulated "AI theme/context randomization" via the MCP bridge (or locally if backend is stubbed).
   - `Edit`: Display mock transition into Edit context.
   - `Export`: Interface visually or via MCP Daemon for code/PNG handoff.

## 2. Environment Probing
- We verified the `agent-daemon.mjs` is listening on port `4124` and provides an `/events` SSE endpoint.
- `GenericPrototype.tsx` is rendering realistic UI via `FakeUIRenderer.tsx` taking a `seed` and `colors`.

## 3. Iterative Execution (Next Action)
- I will create `apps/web/src/utils/useAgentConnection.ts`.
- I will modify `GenericPrototype.tsx` to use this hook and attach click handlers.
