import { useEffect, useMemo, useRef, useState } from "react";
import {
  skillPermissionLabels,
  type RuntimeSkill,
} from "../../../shared/skillRuntime";
import {
  maintenanceSkillIds,
  migrateSkillFavorites,
  productSearch,
  skillProducts,
  type SkillProduct,
} from "../../../shared/skillProducts";
import { apiPublicJSON } from "../../../apps/web/src/api/client";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { MarketNavigation } from "../MarketNavigation";
import { listProjects } from "../projectStore";
import { navigateTo } from "../workspaceRoutes";
import { listWorkflows, type Workflow } from "../api/workflows";
import SkillWorkbench from "../SkillWorkbench";
import WorkflowsPage from "./WorkflowsPage";
import "./skills.css";
import "./skill-products.css";

type Scene = {
  id: string;
  name: string;
  ready: boolean;
  reason: string;
  skills: RuntimeSkill[];
  workflow?: Workflow;
};
function scenesFor(
  product: SkillProduct,
  catalog: RuntimeSkill[],
  workflows: Workflow[],
): Scene[] {
  const chains: Scene[] = product.workflows.map((item) => {
    const workflow = workflows.find((w) => w.id === item.id);
    const blocked =
      workflow?.steps.filter(
        (step) => !step.optional && !step.availability.ready,
      ) ?? [];
    return {
      id: `workflow:${item.id}`,
      name: item.label,
      ready: !!workflow && !blocked.length,
      reason: !workflow
        ? "服务端未登记此流程；未自动改用其他工具。"
        : blocked.map((s) => `${s.title}：${s.availability.reason}`).join("；"),
      workflow,
      skills: (workflow?.steps ?? []).flatMap((step) =>
        catalog.filter((s) => s.id === step.skill),
      ),
    };
  });
  const tools: Scene[] = product.skillIds
    .filter((id) => !maintenanceSkillIds.includes(id))
    .map((id) => {
      const skill = catalog.find((s) => s.id === id);
      return {
        id,
        name: skill?.name ?? id,
        ready: skill?.status === "ready",
        reason:
          skill?.status === "ready"
            ? ""
            : (skill?.availabilityReason ??
              skill?.description ??
              "服务端尚未登记，不能运行。"),
        skills: skill ? [skill] : [],
      };
    });
  return [...chains, ...tools].sort(
    (a, b) =>
      Number(b.id === product.primary) - Number(a.id === product.primary),
  );
}
function favorites(): string[] {
  try {
    return migrateSkillFavorites(
      JSON.parse(
        localStorage.getItem("designbuddy.skill-product-favorites.v1") ??
          localStorage.getItem("designbuddy.skill-favorites.v1") ??
          "[]",
      ),
    );
  } catch {
    return [];
  }
}
const initialProduct = () =>
  new URLSearchParams(window.location.search).get("product") ?? "";
export default function SkillProductsPage() {
  const [catalog, setCatalog] = useState<RuntimeSkill[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [identity, setIdentity] = useState(0);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("全部技能");
  const [saved, setSaved] = useState(favorites);
  const [onlySaved, setOnlySaved] = useState(false);
  const [selected, setSelected] = useState(initialProduct);
  const [sceneId, setSceneId] = useState(
    () => new URLSearchParams(window.location.search).get("scene") ?? "",
  );
  const [details, setDetails] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const chooser = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    const changed = () => {
      setIdentity((v) => v + 1);
      setRefresh((v) => v + 1);
      setSelected("");
      setSceneId("");
    };
    window.addEventListener("designbuddy:server-identity", changed);
    return () =>
      window.removeEventListener("designbuddy:server-identity", changed);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setCatalog([]);
    setWorkflows([]);
    Promise.all([
      apiPublicJSON<{ skills: RuntimeSkill[] }>("/skill-runtime", {
        signal: controller.signal,
      }),
      listWorkflows(controller.signal),
    ])
      .then(([runtime, chains]) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(runtime.skills))
          throw Error("服务端技能目录格式无效。");
        setCatalog(runtime.skills);
        setWorkflows(chains);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "无法读取服务端执行状态。",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "designbuddy.skill-product-favorites.v1",
        JSON.stringify(saved),
      );
    } catch {
      /* Optional local preference; original tool favorites remain untouched. */
    }
  }, [saved]);
  const visible = useMemo(
    () =>
      skillProducts.filter(
        (p) =>
          (area === "全部技能" || p.area === area) &&
          (!onlySaved || saved.includes(p.id)) &&
          productSearch(p, catalog, query),
      ),
    [catalog, area, onlySaved, saved, query],
  );
  const product = skillProducts.find((p) => p.id === selected);
  const scenes = product ? scenesFor(product, catalog, workflows) : [];
  // An explicit invalid scene does not silently select or run something else.
  const scene = scenes.find((s) => s.id === (sceneId || product?.primary));
  const primaryReady = skillProducts.filter(
    (p) =>
      scenesFor(p, catalog, workflows).find((s) => s.id === p.primary)?.ready,
  ).length;
  function updateSelection(
    productId: string,
    nextScene: string,
    focus = false,
  ) {
    setSelected(productId);
    setSceneId(nextScene);
    const url = new URL(window.location.href);
    if (productId) {
      url.searchParams.set("product", productId);
      url.searchParams.set("scene", nextScene);
    } else {
      url.searchParams.delete("product");
      url.searchParams.delete("scene");
    }
    window.history.replaceState(window.history.state, "", url);
    if (focus)
      requestAnimationFrame(() => {
        panel.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        });
        chooser.current?.focus({ preventScroll: true });
      });
  }
  function toggle(id: string) {
    setSaved((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  }
  return (
    <div className="workbuddy-app skill-library-workspace product-workspace">
      <WorkBuddySidebar
        active="skills"
        projectCount={listProjects().length}
        go={navigateTo}
        setNotice={setNotice}
      />
      <main className="skills-main" aria-label="技能工作区">
        <header className="skills-topbar">
          <MarketNavigation active="skills" className="skills-main-nav" />
          <button
            className="product-advanced-link"
            onClick={() => window.location.assign("/skills?advanced=1")}
          >
            <HomeIcon name="settings" size={16} />
            高级工具与历史
          </button>
        </header>
        <div className="skills-content product-content">
          {notice && (
            <div className="skills-message" role="status">
              {notice}
              <button aria-label="关闭提示" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          <section className="product-hero">
            <div>
              <span className="product-eyebrow">DESIGNBUDDY / SKILLS</span>
              <h1>
                选一个成果，
                <br />
                把整件事做好<span>。</span>
              </h1>
              <p>
                不用在工序之间来回挑工具。把材料交给一个技能，
                <br className="product-desktop-break" />
                制作、处理和检查，在同一个工作区完成。
              </p>
            </div>
            <div className="product-hero-note" role="note">
              <span className="product-note-index">01 — 08</span>
              <HomeIcon name="grid" size={32} />
              <h2>一个入口，完整工序</h2>
              <p>
                能自动衔接的流程，直接传递真实产物；不同材料场景按需选择，不强行拼接。
              </p>
              <span>执行成功 ≠ 商业验收</span>
            </div>
          </section>
          <div className="product-summary">
            <span>
              <i />
              {loading
                ? "正在核对服务端状态…"
                : error
                  ? "状态读取失败，未开放运行"
                  : `8 个成果入口 · ${primaryReady} 条主要路径当前可执行`}
            </span>
            <button
              onClick={() => setDetails((v) => !v)}
              aria-expanded={details}
            >
              整合与验收说明 <HomeIcon name="chevron" size={13} />
            </button>
          </div>
          {details && (
            <section className="product-explainer" aria-label="整合与验收说明">
              <h2>减少入口，不减少能力或权限检查</h2>
              <p>
                49 个底层工具保留原
                ID、运行记录和权限。同一流程的工序由服务端自动串联；PPT / Word
                沿用已有内部管线。网页、品牌、海报新增独立流程
                ID，旧历史不被改写。
              </p>
              <p>
                244 项外部目录是方法参考，不等于 244
                个已安装执行器。许可冲突、非商业与未确认项目不进入可商用工具；动画、3D
                等未实现能力不会伪装成新技能。
              </p>
              <p>
                当前交付均需人工验收。静态门槛、渲染与人工商业审查是不同层级；缺配置、缺材料、未授权或未实现时明确阻断。收起界面不会取消后台任务。
              </p>
            </section>
          )}
          <section aria-label="成果技能目录" className="product-directory">
            <div className="product-toolbar">
              <div
                className="skill-category-track"
                role="group"
                aria-label="技能分类"
              >
                {["全部技能", "办公提效", "设计制作", "网页与项目"].map(
                  (value) => (
                    <button
                      key={value}
                      aria-pressed={area === value}
                      className={area === value ? "is-active" : ""}
                      onClick={() => setArea(value)}
                    >
                      {value}
                    </button>
                  ),
                )}
              </div>
              <label className="skills-search">
                <HomeIcon name="search" size={16} />
                <input
                  type="search"
                  aria-label="搜索成果技能"
                  placeholder="搜索成果、用途或原工具"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="product-result">
              <span role="status">
                {visible.length} 个成果技能
                {query ? `匹配“${query}”` : " · 按交付选择"}
              </span>
              <button
                aria-pressed={onlySaved}
                onClick={() => setOnlySaved((v) => !v)}
              >
                {onlySaved ? "显示全部" : "只看收藏"}（{saved.length}）
              </button>
            </div>
            {error && (
              <div className="skills-message is-error" role="alert">
                <span>{error}</span>
                <button onClick={() => setRefresh((v) => v + 1)}>
                  重试加载
                </button>
              </div>
            )}
            <div className="product-grid">
              {visible.map((p) => {
                const primary = scenesFor(p, catalog, workflows).find(
                  (s) => s.id === p.primary,
                );
                return (
                  <article
                    className={`product-card product-card-${p.id}`}
                    key={p.id}
                    aria-label={p.name}
                    data-product={p.id}
                  >
                    <div className="product-card-top">
                      <span className="product-icon">
                        <HomeIcon name={p.icon} size={25} />
                      </span>
                      <button
                        className="product-save"
                        aria-pressed={saved.includes(p.id)}
                        aria-label={`${saved.includes(p.id) ? "取消收藏" : "收藏"}：${p.name}`}
                        onClick={() => toggle(p.id)}
                      >
                        <HomeIcon
                          name={saved.includes(p.id) ? "check" : "plus"}
                          size={17}
                        />
                      </button>
                    </div>
                    <span className="product-area">{p.area}</span>
                    <h2>{p.name}</h2>
                    <p>{p.description}</p>
                    <ul className="product-deliveries" aria-label="交付物">
                      {p.delivery.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <footer>
                      <span
                        className={`product-state${!primary?.ready ? " needs-setup" : ""}`}
                      >
                        {loading
                          ? "核对中"
                          : error
                            ? "状态未知"
                            : primary?.ready
                              ? "可执行 · 待验收"
                              : "主要路径需配置"}
                      </span>
                      <button
                        disabled={loading || !!error}
                        onClick={() => updateSelection(p.id, p.primary, true)}
                        aria-label={`打开技能：${p.name}`}
                      >
                        进入技能 <span aria-hidden="true">↗</span>
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
            {!visible.length && (
              <div className="skill-empty">
                <h2>没有匹配的成果技能</h2>
                <p>可以按原工具名搜索；原收藏已归入对应成果，原记录仍保留。</p>
                <button
                  onClick={() => {
                    setQuery("");
                    setArea("全部技能");
                    setOnlySaved(false);
                  }}
                >
                  重置筛选
                </button>
              </div>
            )}
          </section>
          {selected && !product && (
            <p role="alert">未找到指定成果入口，没有自动打开其他工具。</p>
          )}
          {product && !loading && !error && (
            <section
              ref={panel}
              className="product-panel"
              aria-label={`${product.name}工作区`}
            >
              <header className="product-panel-heading">
                <div>
                  <span className="product-eyebrow">
                    ONE SKILL / ONE OUTCOME
                  </span>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                </div>
                <button
                  onClick={() => {
                    const id = product.id;
                    updateSelection("", "");
                    requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLButtonElement>(
                          `[data-product="${id}"] footer button`,
                        )
                        ?.focus(),
                    );
                  }}
                >
                  收起工作区
                </button>
              </header>
              <ol className="product-stages" aria-label="交付工序">
                {product.stages.map((step, i) => (
                  <li key={step}>
                    <b>{String(i + 1).padStart(2, "0")}</b>
                    {step}
                  </li>
                ))}
              </ol>
              <div className="product-scene-picker">
                <label htmlFor="product-scene">这次要完成什么</label>
                <select
                  id="product-scene"
                  ref={chooser}
                  value={scene?.id ?? ""}
                  onChange={(e) => updateSelection(product.id, e.target.value)}
                >
                  {!scene && <option value="">请选择有效场景</option>}
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {!s.ready ? "（当前不可执行）" : ""}
                    </option>
                  ))}
                </select>
                <p>
                  同链工序会自动衔接。切换场景会清空未提交的表单；已提交任务保留在历史中。
                </p>
              </div>
              <details className="product-boundary">
                <summary>交付边界、权限与人工验收</summary>
                <p>{product.boundary}</p>
                {scene && (
                  <>
                    <ul>
                      {[
                        ...new Set(
                          scene.skills.flatMap((s) => s.permissions ?? []),
                        ),
                      ].map((permission) => (
                        <li key={permission}>
                          {skillPermissionLabels[permission]}
                        </li>
                      ))}
                    </ul>
                    {scene.skills.map((s) => (
                      <div key={s.id}>
                        <h3>{s.name}</h3>
                        <p>{s.limits}</p>
                        {s.requires?.map((r) => (
                          <p key={r.label}>
                            <b>{r.label}：</b>
                            {r.detail}
                          </p>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </details>
              {!scene && (
                <p role="alert">
                  指定场景无效，未自动改用其他工具。请明确选择。
                </p>
              )}
              {scene && !scene.ready && (
                <div className="product-blocked" role="status">
                  <h3>当前不能执行此场景</h3>
                  <p>{scene.reason}</p>
                  <p>
                    可以选择本技能内其他可用场景；不会擅自配置凭据、购买服务或外发材料。
                  </p>
                </div>
              )}
              {scene?.ready &&
                (scene.workflow ? (
                  <WorkflowsPage
                    key={`${identity}:${scene.id}`}
                    embedded
                    initialWorkflowId={scene.workflow.id}
                  />
                ) : (
                  <SkillWorkbench
                    key={`${identity}:${scene.id}`}
                    allowedSkillIds={[scene.id]}
                    initialSkillId={scene.id}
                  />
                ))}
              <p className="product-history-note">
                同一账号的旧记录仍可从高级工具或原工作流历史查看。
                <button onClick={() => window.location.assign("/workflows")}>
                  查看全部流程历史 ↗
                </button>
              </p>
            </section>
          )}
          <footer className="product-footnote">
            <HomeIcon name="shield" size={17} />
            <p>
              真实材料、明确权限、可追踪产物。尚未通过人工商业验收的结果，始终按草稿或诊断交付。
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
