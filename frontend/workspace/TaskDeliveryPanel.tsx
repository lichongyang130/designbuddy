import { useEffect, useState } from "react";
import { apiJSON, apiFetch } from "../../apps/web/src/api/client";
import { skillProducts, maintenanceSkillIds } from "../../shared/skillProducts";
import type {
  ExpertTaskPlan,
  ExpertTaskExecution,
} from "../../shared/expertExecution";
import SkillWorkbench from "./SkillWorkbench";
import WorkflowsPage from "./pages/WorkflowsPage";
import "./task-delivery.css";

export type TaskDelivery = {
  productId: string;
  lockedExpert: boolean;
  sceneId?: string;
  goal?: string;
};
export default function TaskDeliveryPanel({
  taskId,
  goal,
  expertId,
  delivery,
  permission,
  model,
  onChange,
  materials = [],
}: {
  taskId: string;
  goal: string;
  expertId?: string;
  delivery: TaskDelivery;
  permission: string;
  model: string;
  materials?: { name: string; text?: string; assetId?: string }[];
  onChange: (delivery: TaskDelivery, expertId?: string) => void;
}) {
  const [refresh, setRefresh] = useState(0);
  const requestKey = JSON.stringify([
    taskId,
    goal,
    expertId,
    delivery,
    permission,
    refresh,
  ]);
  const [resolved, setResolved] = useState<{
    key: string;
    plan: ExpertTaskPlan;
  } | null>(null);
  const plan = resolved?.key === requestKey ? resolved.plan : null;
  const [history, setHistory] = useState<ExpertTaskExecution[]>([]);
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [materialError, setMaterialError] = useState("");
  const [error, setError] = useState("");
  const product = skillProducts.find((p) => p.id === delivery.productId);
  useEffect(() => {
    if (permission === "仅本地") return;
    const controller = new AbortController();
    setResolved(null);
    setError("");
    setHistory([]);
    setMaterialFiles([]);
    Promise.all([
      apiJSON<{ plan: ExpertTaskPlan }>("/expert-task-plans", {
        method: "POST",
        signal: controller.signal,
        retryOnIdentityChange: false,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          goal: delivery.goal || goal,
          productId: delivery.productId,
          expertId,
          lockedExpert: delivery.lockedExpert,
          sceneId: delivery.sceneId,
          permission,
        }),
      }),
      apiJSON<{ executions: ExpertTaskExecution[] }>(
        `/expert-task-plans?taskId=${encodeURIComponent(taskId)}`,
        { signal: controller.signal },
      ),
    ])
      .then(([p, h]) => {
        if (!controller.signal.aborted) {
          setResolved({ key: requestKey, plan: p.plan });
          setHistory(h.executions);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "无法读取制作计划。",
          );
      });
    return () => controller.abort();
  }, [
    taskId,
    goal,
    expertId,
    delivery.productId,
    delivery.goal,
    delivery.sceneId,
    delivery.lockedExpert,
    permission,
    refresh,
  ]);
  const refreshHistory = () => {
    void apiJSON<{ executions: ExpertTaskExecution[] }>(
      `/expert-task-plans?taskId=${encodeURIComponent(taskId)}`,
    )
      .then((h) => setHistory(h.executions))
      .catch(() =>
        setError("执行已提交，但版本记录读取失败，请刷新查看真实运行。"),
      );
  };
  async function carryMaterials() {
    setLoadingMaterials(true);
    setMaterialError("");
    try {
      const files: File[] = [];
      for (const material of materials) {
        if (material.assetId) {
          const { asset } = await apiJSON<{
            asset: { name: string; size: number; sha256: string };
          }>(`/assets/${encodeURIComponent(material.assetId)}`);
          if (asset.size > 2_000_000)
            throw Error(
              `${asset.name} 超过本路线单文件2MB限制；未截断或自动发送。`,
            );
          const response = await apiFetch(
            `/assets/${encodeURIComponent(material.assetId)}/download`,
          );
          if (!response.ok)
            throw Error(`${asset.name} 读取失败，请核对账号或重新上传。`);
          const bytes = await response.arrayBuffer();
          const digest = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            (b) => b.toString(16).padStart(2, "0"),
          ).join("");
          if (bytes.byteLength !== asset.size || digest !== asset.sha256)
            throw Error("材料哈希不一致，未带入。请重新上传。");
          files.push(new File([bytes], asset.name));
        } else if (material.text)
          files.push(
            new File([material.text], material.name, { type: "text/plain" }),
          );
        else
          throw Error(
            `${material.name} 只有名称，没有实际可读取内容，请重新选择文件。`,
          );
      }
      setMaterialFiles(files);
    } catch (cause) {
      setMaterialError(
        cause instanceof Error ? cause.message : "材料读取失败。",
      );
    } finally {
      setLoadingMaterials(false);
    }
  }
  if (permission === "仅本地")
    return (
      <section className="task-delivery" aria-label="专家制作与交付">
        <h2>仅本地 · 制作目标已保留</h2>
        <p>
          不会创建后台计划、上传材料或调用模型。修改任务权限后，仍需单独确认执行。
        </p>
      </section>
    );
  return (
    <section className="task-delivery" aria-label="专家制作与交付">
      <header>
        <span className="delivery-eyebrow">EXPERT / REAL EXECUTION</span>
        <h2>{product?.name || "制作与交付"}</h2>
        <p>专业规范决定路线，实际执行器负责制作。计划不是执行结果。</p>
      </header>
      <div className="delivery-selectors">
        <label>
          交付成果
          <select
            aria-label="交付成果"
            value={delivery.productId}
            onChange={(e) =>
              onChange(
                { ...delivery, productId: e.target.value, sceneId: undefined },
                expertId,
              )
            }
          >
            {skillProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          制作场景
          <select
            aria-label="制作场景"
            value={delivery.sceneId || product?.primary || ""}
            onChange={(e) =>
              onChange({ ...delivery, sceneId: e.target.value }, expertId)
            }
          >
            {product?.workflows.map((w) => (
              <option key={w.id} value={`workflow:${w.id}`}>
                {w.label}
              </option>
            ))}
            {product?.skillIds
              .filter((id) => !maintenanceSkillIds.includes(id))
              .map((id) => (
                <option key={id} value={id}>
                  {id === product.primary
                    ? "主要制作路径 · "
                    : "明确选择高级场景 · "}
                  {id}
                </option>
              ))}
          </select>
        </label>
      </div>
      {error && (
        <div role="alert" className="delivery-error">
          <p>{error}</p>
          <button type="button" onClick={() => setRefresh((v) => v + 1)}>
            重新核对
          </button>
          {expertId && (
            <button
              type="button"
              onClick={() =>
                onChange({ ...delivery, lockedExpert: false }, undefined)
              }
            >
              明确允许按成果重新分配主责
            </button>
          )}
        </div>
      )}
      {!plan && !error && (
        <p role="status">正在核对专家绑定与服务端真实能力…</p>
      )}
      {plan && (
        <>
          <section className="delivery-plan" aria-label="专家制作计划">
            <div>
              <strong>主责：{plan.expert.name}</strong>
              <span>
                {plan.lockedExpert ? "用户指定 · 不自动换人" : "按成果分配"}
              </span>
            </div>
            <p>{plan.goal}</p>
            <ol>
              {plan.steps.map((s, i) => (
                <li key={i}>
                  <b>{s.title}</b>
                  <small>
                    {s.skillId} · 执行角色 {s.expertId}
                  </small>
                  <span>
                    {s.ready ? "计划调用 · 尚不代表执行" : "当前不可用"}
                  </span>
                </li>
              ))}
            </ol>
            <details>
              <summary>专业方法、检查要求与边界</summary>
              <h3>工作方法</h3>
              <ul>
                {plan.expert.method.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <h3>交付核验</h3>
              <ul>
                {plan.expert.checks.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p>{plan.boundary}</p>
              <p>
                专家配置 {plan.expert.configVersion} · 执行器{" "}
                {plan.route.version}
              </p>
              <p>
                计划 {plan.id} · 确认摘要 {plan.approvalDigest.slice(0, 16)}
              </p>
            </details>
            {!plan.ready && (
              <div role="status" className="delivery-error">
                <b>当前路线已阻断，没有启动制作</b>
                <ul>
                  {plan.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p>
                  不会静默降级。配置完成后重新核对；也可明确选择适用的其他场景。
                </p>
                <button type="button" onClick={() => setRefresh((v) => v + 1)}>
                  配置后重新核对
                </button>
              </div>
            )}
          </section>
          {!!materials.length && (
            <section aria-label="本任务原始材料">
              <p>
                已关联：{materials.map((m) => m.name).join("、")}
                。文件名称不代表已解析。
              </p>
              <button
                type="button"
                disabled={loadingMaterials}
                onClick={() => void carryMaterials()}
              >
                {loadingMaterials
                  ? "正在读取应用内材料…"
                  : "带入已上传材料（不发送给模型）"}
              </button>
              {materialFiles.length > 0 && (
                <p role="status">
                  已读取{materialFiles.length}
                  份实际材料；请在下方核对适用格式，制作与外发仍需确认。
                </p>
              )}
              {materialError && <p role="alert">{materialError}</p>}
            </section>
          )}
          <p className="delivery-note">
            下面准备与核对真实输入。点击执行才上传制作；第三方正文处理需另行授权。修改材料或参数后必须重新确认。
          </p>
          {plan.route.kind === "workflow" ? (
            <WorkflowsPage
              key={plan.id}
              embedded
              initialWorkflowId={plan.route.id}
              taskId={taskId}
              executionPlan={plan}
              onRun={refreshHistory}
            />
          ) : (
            <SkillWorkbench
              key={plan.id}
              taskId={taskId}
              expertId={plan.route.executorExpertId}
              allowedSkillIds={[plan.route.id]}
              initialSkillId={plan.route.id}
              initialGoal={plan.goal}
              model={model}
              permission={permission}
              executionPlan={plan}
              initialMaterials={materialFiles}
              onSkillExecute={refreshHistory}
            />
          )}
        </>
      )}
      {!!history.length && (
        <details className="delivery-versions" open>
          <summary>本任务的真实提交与版本（{history.length}）</summary>
          <p>
            版本表示一次已确认的制作输入，不表示通过检查或已经修改成功。状态、文件和报告以上方真实运行结果为准。
          </p>
          <ol>
            {history.map((e) => (
              <li key={e.id}>
                <b>V{e.revision}</b> ·{" "}
                {e.state === "linked"
                  ? "已关联真实运行"
                  : e.state === "dispatch-failed"
                    ? "未启动"
                    : "提交中或连接中断，需核对"}
                <small>
                  运行 {e.runId || "尚无"} · 输入 SHA-256 {e.inputHash}
                </small>
                {e.parentId && <small>上一版本 {e.parentId}</small>}
                {e.error && <span>{e.error}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
      <p className="delivery-note">
        修改时请更新本任务要求和实际输入，再确认生成新版本；原文件保留。当前不承诺任意旧Word/PPT原生对象的自动无损修改，也不把执行完成当商业验收。
      </p>
    </section>
  );
}
