export type PluginPermission =
  | "workspace:read"
  | "workspace:write:approval"
  | "network:allowlisted"
  | "process:execute:approval"
  | "secrets:read:approval";

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: PluginPermission[];
  entry: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

export type PluginContext = {
  workspaceId: string;
  actorId: string;
  signal: AbortSignal;
  emit: (event: RuntimeEvent) => void;
  requestApproval: (request: ApprovalRequest) => Promise<boolean>;
  readWorkspaceFile: (path: string) => Promise<string>;
  writeWorkspaceFile: (path: string, content: string) => Promise<void>;
};

export type RuntimeEvent =
  | { type: "plugin.started"; pluginId: string; runId: string; at: string }
  | { type: "plugin.progress"; pluginId: string; runId: string; message: string; percent?: number }
  | { type: "plugin.completed"; pluginId: string; runId: string; durationMs: number }
  | { type: "plugin.failed"; pluginId: string; runId: string; code: string; message: string };

export type ApprovalRequest = {
  title: string;
  explanation: string;
  permission: PluginPermission;
  resource?: string;
};

export type PluginHandler<I = unknown, O = unknown> = (
  input: I,
  context: PluginContext,
) => Promise<O>;

export type PluginDefinition<I = unknown, O = unknown> = {
  manifest: PluginManifest;
  run: PluginHandler<I, O>;
};

const dangerousPermissions = new Set<PluginPermission>([
  "workspace:write:approval",
  "network:allowlisted",
  "process:execute:approval",
  "secrets:read:approval",
]);

export function validateManifest(manifest: PluginManifest): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(manifest.id)) errors.push("Invalid plugin id");
  if (!manifest.name.trim()) errors.push("Plugin name is required");
  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) errors.push("Version must use semver");
  if (!manifest.entry.startsWith("./") && !manifest.entry.startsWith("https://")) errors.push("Entry must be a relative module or HTTPS URL");
  if (new Set(manifest.permissions).size !== manifest.permissions.length) errors.push("Duplicate permissions are not allowed");
  return errors;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginDefinition>();

  register(definition: PluginDefinition): void {
    const errors = validateManifest(definition.manifest);
    if (errors.length) throw new Error(`Invalid plugin manifest: ${errors.join("; ")}`);
    if (this.plugins.has(definition.manifest.id)) throw new Error(`Plugin already registered: ${definition.manifest.id}`);
    this.plugins.set(definition.manifest.id, definition);
  }

  list(): PluginManifest[] {
    return [...this.plugins.values()].map((plugin) => structuredClone(plugin.manifest));
  }

  get(id: string): PluginDefinition | undefined {
    return this.plugins.get(id);
  }
}

export async function runPlugin<I, O>(
  definition: PluginDefinition<I, O>,
  input: I,
  context: PluginContext,
  options: { timeoutMs?: number; runId?: string } = {},
): Promise<O> {
  const { manifest } = definition;
  const errors = validateManifest(manifest);
  if (errors.length) throw new Error(`Invalid plugin manifest: ${errors.join("; ")}`);
  const runId = options.runId ?? crypto.randomUUID();
  const started = Date.now();
  context.emit({ type: "plugin.started", pluginId: manifest.id, runId, at: new Date().toISOString() });

  for (const permission of manifest.permissions) {
    if (!dangerousPermissions.has(permission)) continue;
    const approved = await context.requestApproval({
      title: `授权插件：${manifest.name}`,
      explanation: `该操作需要权限 ${permission}。请确认本次运行的访问范围。`,
      permission,
    });
    if (!approved) {
      context.emit({ type: "plugin.failed", pluginId: manifest.id, runId, code: "PERMISSION_DENIED", message: `Permission denied: ${permission}` });
      throw new Error(`Permission denied: ${permission}`);
    }
  }

  if (context.signal.aborted) throw new DOMException("Plugin run aborted", "AbortError");
  const timeoutMs = options.timeoutMs ?? 60_000;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      definition.run(input, context),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("PLUGIN_TIMEOUT")), timeoutMs);
      }),
    ]);
    context.emit({ type: "plugin.completed", pluginId: manifest.id, runId, durationMs: Date.now() - started });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown plugin error";
    context.emit({ type: "plugin.failed", pluginId: manifest.id, runId, code: message === "PLUGIN_TIMEOUT" ? "TIMEOUT" : "EXECUTION_FAILED", message });
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
