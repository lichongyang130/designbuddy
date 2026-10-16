/**
 * The workspace the person is currently working in.
 *
 * The choice follows the account on this device only: the server keeps the
 * membership, the device keeps which workspace is in focus.
 */
const ACTIVE_WORKSPACE_KEY = "designbuddy.active-workspace.v1";

export type ActiveWorkspace = { id: string; name: string };

function read(): ActiveWorkspace {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ACTIVE_WORKSPACE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return { id: "", name: "" };
    const value = parsed as { id?: unknown; name?: unknown };
    return {
      id: typeof value.id === "string" ? value.id : "",
      name: typeof value.name === "string" ? value.name : "",
    };
  } catch {
    return { id: "", name: "" };
  }
}

export function readActiveWorkspaceId(): string {
  return read().id;
}

/** The workspace in focus, with the name shown in the interface. */
export function readActiveWorkspace(): ActiveWorkspace {
  return read();
}

export function writeActiveWorkspaceId(workspaceId: string, name = ""): void {
  try {
    if (workspaceId) localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify({ id: workspaceId, name }));
    else localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    /* the choice is a convenience, never a blocker */
  }
}
