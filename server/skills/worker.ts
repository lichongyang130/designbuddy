import { parentPort, workerData } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import { executeSkill } from "./executors";
if (parentPort) {
  const pending = new Map<string, (error?: Error) => void>();
  parentPort.on("message", message => {
    if (message?.type !== "checkpoint-saved" && message?.type !== "checkpoint-error") return;
    const done = pending.get(message.id); if (!done) return; pending.delete(message.id);
    done(message.type === "checkpoint-error" ? new Error("任务检查点未能持久保存，任务中止以避免丢失进度。") : undefined);
  });
  const checkpoint = (value: unknown) => new Promise<void>((resolve, reject) => {
    const id = randomUUID(); const timer = setTimeout(() => { pending.delete(id); reject(new Error("保存任务检查点超时。")); }, 15000);
    pending.set(id, error => { clearTimeout(timer); error ? reject(error) : resolve(); });
    parentPort!.postMessage({ type: "checkpoint", id, checkpoint: value });
  });
  executeSkill({ ...workerData, onAIUsage: (usage: unknown) => parentPort!.postMessage({ type: "ai-usage", usage }) }, message => parentPort!.postMessage({ type: "event", message }), checkpoint, checkpoint)
    .then(result => parentPort!.postMessage({ type: "result", result }))
    .catch(error => parentPort!.postMessage({ type: "failure", error: error instanceof Error ? error.message.slice(0, 400) : "执行失败。" }));
}
