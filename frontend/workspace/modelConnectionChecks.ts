import { create } from "zustand";
import type { CustomModel } from "./settingsStore";
import {
  customModelKeyRevision,
  readCustomModelApiKey,
} from "./aiProviderStorage";
import { testModelConnection, type ModelConnectionResult } from "./api/models";

export type ConnectionCheck = {
  status: "checking" | "verified" | "reachable" | "failed";
  stamp: string;
  checkedAt: number;
};
// Deliberately session-memory only. No API keys, provider errors or result claims are synced.
export const useModelConnectionChecks = create<{
  checks: Record<string, ConnectionCheck>;
}>(() => ({ checks: {} }));
export function modelCheckStamp(
  model: Pick<CustomModel, "modelId" | "provider" | "baseUrl">,
) {
  return JSON.stringify([
    model.modelId,
    model.provider || "server",
    model.baseUrl || "",
    customModelKeyRevision(model.modelId),
  ]);
}
export function recordModelCheck(
  model: CustomModel,
  result: ModelConnectionResult,
  stamp = modelCheckStamp(model),
) {
  if (stamp !== modelCheckStamp(model)) return;
  useModelConnectionChecks.setState((state) => ({
    checks: {
      ...state.checks,
      [model.id]: {
        stamp,
        checkedAt: Date.now(),
        status:
          result.ok !== true ||
          (Number(result.modelCount) > 0 && result.modelFound !== true)
            ? "failed"
            : result.modelFound === true
              ? "verified"
              : "reachable",
      },
    },
  }));
}
const pending = new Map<string, Promise<void>>();
export function verifySavedModel(model: CustomModel): Promise<void> {
  if (pending.has(model.id)) return pending.get(model.id)!;
  const apiKey = readCustomModelApiKey(model.modelId).trim();
  if (!model.provider || !apiKey)
    return Promise.reject(
      new Error(!model.provider ? "serverProbeHelp" : "keyMissing"),
    );
  const stamp = modelCheckStamp(model);
  useModelConnectionChecks.setState((state) => ({
    checks: {
      ...state.checks,
      [model.id]: { status: "checking", stamp, checkedAt: Date.now() },
    },
  }));
  const task = (async () => {
    try {
      const result = await testModelConnection({
        provider: model.provider!,
        modelId: model.modelId,
        baseUrl: model.provider === "custom" ? model.baseUrl : undefined,
        apiKey,
      });
      recordModelCheck(model, result, stamp);
    } catch {
      recordModelCheck(model, { ok: false }, stamp);
    } finally {
      pending.delete(model.id);
    }
  })();
  pending.set(model.id, task);
  return task;
}
