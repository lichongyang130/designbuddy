import { useEffect } from "react";
import { create } from "zustand";

type RuntimeActivityState = { activeCount: number };

/** Shared, reference-counted signal for work that is currently executing. */
export const useRuntimeActivityState = create<RuntimeActivityState>(() => ({
  activeCount: 0,
}));

const activeOperations = new Set<symbol>();

/** Register one active operation and return an idempotent cleanup function. */
export function beginRuntimeActivity(): () => void {
  const token = Symbol("runtime-activity");
  activeOperations.add(token);
  useRuntimeActivityState.setState({ activeCount: activeOperations.size });
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activeOperations.delete(token);
    useRuntimeActivityState.setState({ activeCount: activeOperations.size });
  };
}

/** Components report active work; preference state decides whether to hold awake. */
export function useRuntimeActivity(active: boolean): void {
  useEffect(() => (active ? beginRuntimeActivity() : undefined), [active]);
}
