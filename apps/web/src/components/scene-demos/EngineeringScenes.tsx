import { useState } from "react";
import { Operations, OrderEditor } from "./Operations";
import { uploadImage } from "./files";
import { useSceneState } from "./workspace";
import {
  art,
  Avatar,
  Badge,
  Field,
  Select,
  Toolbar,
  money,
  downloadText,
  csvCell,
  Sparkline,
} from "./shared";

export function Website() {
  const [siteTitle, setSiteTitle] = useSceneState(
      "siteTitle",
      "为明天，\n注入可持续的力量。",
    ),
    [siteDescription, setSiteDescription] = useSceneState(
      "siteDescription",
      "从项目规划到运营管理，\n构建可靠、透明的清洁能源解决方案。",
    ),
    [heroImage, setHeroImage] = useSceneState("heroImage", art.energy);
  const [page, setPage] = useSceneState("page", "首页"),
    [name, setName] = useSceneState("name", ""),
    [email, setEmail] = useSceneState("email", ""),
    [type, setType] = useSceneState("type", "企业用能"),
    [feedback, setFeedback] = useSceneState("feedback", "");
  return (
    <div className="pd-energy-site">
      {feedback && page !== "联系" && (
        <p className="ws-inline-status" role="status">
          {feedback}
        </p>
      )}
      <nav>
        <strong>
          <i>↗</i> NORTH<span>ENERGY</span>
        </strong>
        <div>
          {["首页", "项目", "联系"].map((p) => (
            <button
              aria-current={page === p ? "page" : undefined}
              key={p}
              onClick={() => {
                setPage(p);
                setFeedback("");
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <button className="pd-energy-contact" onClick={() => setPage("联系")}>
          与我们合作 ↗
        </button>
      </nav>
      {page === "首页" ? (
        <>
          <section className="pd-energy-hero">
            <img src={heroImage} alt="海岸风电设施与远处的海上风机" />
            <div>
              <small>CLEAN ENERGY. SHARED FUTURE.</small>
              <h1>
                <textarea
                  aria-label="官网主标题"
                  className="ws-inline-heading"
                  rows={2}
                  value={siteTitle}
                  maxLength={100}
                  onChange={(e) => setSiteTitle(e.target.value)}
                />
              </h1>
              <p>
                <textarea
                  aria-label="官网简介"
                  className="ws-inline-copy"
                  rows={2}
                  value={siteDescription}
                  maxLength={300}
                  onChange={(e) => setSiteDescription(e.target.value)}
                />
              </p>
              <button onClick={() => setPage("项目")}>
                探索我们的项目　↗
              </button>
            </div>
            <label className="pd-photo-credit ws-upload">
              更换主视觉
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f)
                    try {
                      setHeroImage(await uploadImage(f));
                    } catch (err) {
                      setFeedback((err as Error).message);
                    }
                }}
              />
            </label>
          </section>
          <section className="pd-energy-metrics">
            {[
              ["01", "项目规划", "场址研究与可行性评估"],
              ["02", "工程建设", "质量、进度与安全协同"],
              ["03", "运营管理", "长期监测与维护计划"],
            ].map(([n, a, b]) => (
              <article key={n}>
                <b>{n}</b>
                <div>
                  <h2>{a}</h2>
                  <p>{b}</p>
                </div>
              </article>
            ))}
          </section>
          <section className="pd-energy-intro">
            <div>
              <small>OUR APPROACH</small>
              <h2>
                可持续不止于能源，
                <br />
                更在于每一个决策。
              </h2>
            </div>
            <p>
              以项目全周期为视角，协同业主、工程与运维团队。这里展示的是虚构能源企业的完整官网设计，不包含真实项目业绩承诺。
            </p>
          </section>
        </>
      ) : page === "项目" ? (
        <section className="pd-energy-projects">
          <header>
            <small>SELECTED PROJECTS</small>
            <h1>不同场景，同样可靠的标准。</h1>
          </header>
          <div className="pd-energy-project-feature">
            <img src={art.energy} alt="海岸风电概念项目" />
            <div>
              <Badge>示例项目 / 风能</Badge>
              <h2>海岸清洁能源计划</h2>
              <p>
                将场址研究、环境评估与运维准备纳入统一计划，在设计阶段明确后续运营要求。
              </p>
              <dl>
                <div>
                  <dt>项目阶段</dt>
                  <dd>方案研究</dd>
                </div>
                <div>
                  <dt>建设类型</dt>
                  <dd>海岸风电</dd>
                </div>
                <div>
                  <dt>重点工作</dt>
                  <dd>环境评估与并网研究</dd>
                </div>
              </dl>
              <button onClick={() => setPage("联系")}>咨询相似项目 →</button>
            </div>
          </div>
          <div className="pd-energy-services">
            {["园区用能优化", "清洁能源采购", "运行维护管理"].map((s, i) => (
              <article key={s}>
                <small>0{i + 2} / SOLUTIONS</small>
                <h2>{s}</h2>
                <p>
                  {
                    [
                      "围绕负荷、空间与实际用能需求，建立可评估的优化方案。",
                      "明确采购边界、信息披露与合同要求，让合作可追溯。",
                      "从设备台账到计划检修，建立持续改进的运维流程。",
                    ][i]
                  }
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="pd-energy-contact-page">
          <div>
            <small>LET'S BUILD WHAT'S NEXT.</small>
            <h1>
              让好的想法，
              <br />
              拥有可靠的起点。
            </h1>
            <p>告诉我们项目方向，从一次清晰的需求沟通开始。</p>
            <img src={art.energy} alt="风电场概念环境" />
          </div>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setFeedback(
                name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                  ? "表单校验通过。此设计演示不提交线索，不会发送邮件。"
                  : "请填写联系人与有效邮箱。",
              );
            }}
          >
            <h2>合作咨询</h2>
            <Field label="联系人" value={name} onChange={setName} />
            <Field label="联系邮箱" value={email} onChange={setEmail} />
            <Select
              label="合作方向"
              value={type}
              onChange={setType}
              options={[
                ["企业用能", "企业用能"],
                ["工程合作", "工程合作"],
                ["运营管理", "运营管理"],
              ]}
            />
            <button className="pd-primary">检查咨询表单 →</button>
            {feedback && <p role="status">{feedback}</p>}
            <small>仅演示表单校验，不收集或传输个人信息。</small>
          </form>
        </section>
      )}
      <footer className="pd-energy-footer">
        <strong>NORTH / ENERGY</strong>
        <span>让可持续，成为共同的日常。</span>
        <small>虚构企业官网 · 本地交互示例</small>
      </footer>
    </div>
  );
}

const initialOrders = Array.from({ length: 12 }, (_, i) => ({
  id: `AU-${1048 + i}`,
  customer: [
    "杭州星野设计",
    "上海禾木工作室",
    "深圳原点科技",
    "北京长风文化",
    "南京清禾商贸",
    "成都回声设计",
  ][i % 6],
  product: ["AURA ONE 标准版", "AURA ONE 商务套装", "AURA ONE 体验租赁"][i % 3],
  qty: 1 + (i % 4),
  price: [1299, 1299, 199][i % 3],
  status: ["待处理", "已发货", "已完成"][i % 3],
  date: `2026-10-${String(12 + (i % 4)).padStart(2, "0")}`,
  owner: ["林晓", "陈宁", "周远"][i % 3],
}));
export function Dashboard() {
  const [module, setModule] = useSceneState("module", "订单管理"),
    [role, setRole] = useSceneState("role", "编辑者");
  const [orders, writeOrders] = useSceneState("orders", initialOrders),
    [q, setQ] = useSceneState("q", ""),
    [status, setStatus] = useSceneState("status", "全部"),
    [selected, setSelected] = useSceneState<string[]>("selected", []),
    [detail, setDetail] = useSceneState<string | null>("detail", null),
    [page, setPage] = useSceneState("page", 0),
    [note, setNote] = useSceneState("note", "");
  const setOrders: typeof writeOrders = (next) => {
    if (role === "只读") {
      setNote("只读角色不能修改订单。");
      return;
    }
    writeOrders(next);
  };
  const moduleNav = (
    <>
      {["经营概览", "订单管理", "产品目录", "库存管理", "客户档案"].map((m) => (
        <button
          key={m}
          className={module === m ? "active" : ""}
          aria-current={module === m ? "page" : undefined}
          onClick={() => setModule(m)}
        >
          {m}
        </button>
      ))}
      <label>
        本地权限演示
        <select
          aria-label="后台权限"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option>编辑者</option>
          <option>只读</option>
        </select>
      </label>
    </>
  );
  if (module !== "订单管理")
    return (
      <div className="pd-order-app">
        <aside className="pd-admin-sidebar">
          <b>
            AURA<span>OPERATIONS</span>
          </b>
          <small>业务管理</small>
          {moduleNav}
        </aside>
        <Operations
          key={module}
          module={module}
          orders={orders}
          readOnly={role === "只读"}
        />
      </div>
    );
  const filtered = orders.filter(
    (o) =>
      (status === "全部" || o.status === status) &&
      `${o.id}${o.customer}${o.product}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const visible = filtered.slice(page * 6, page * 6 + 6);
  const record = orders.find((o) => o.id === detail);
  return (
    <div className="pd-order-app">
      <aside className="pd-admin-sidebar">
        <b>
          AURA<span>OPERATIONS</span>
        </b>
        <small>业务管理</small>
        {moduleNav}
        <div>
          <Avatar name="林晓" />
          <p>
            林晓<small>运营工作区 / 示例</small>
          </p>
        </div>
      </aside>
      <div className="pd-order-content">
        <Toolbar brand="工作台" title="订单管理">
          <Badge tone="neutral">本地演示数据</Badge>
        </Toolbar>
        <div className="pd-order-inner">
          <OrderEditor
            orders={orders}
            onChange={(value) => {
              setOrders(value);
              setPage(0);
              setSelected([]);
              setDetail(null);
            }}
            readOnly={role === "只读"}
          />
          <header className="pd-section-title">
            <div>
              <h1>订单管理</h1>
              <p>从下单到交付，清晰掌握每一笔业务。</p>
            </div>
            <button
              onClick={() =>
                downloadText(
                  "order-list.csv",
                  "\uFEFF" +
                    [
                      ["订单号", "客户", "商品", "数量", "金额", "状态"],
                      ...filtered.map((o) => [
                        o.id,
                        o.customer,
                        o.product,
                        o.qty,
                        o.qty * o.price,
                        o.status,
                      ]),
                    ]
                      .map((r) => r.map(csvCell).join(","))
                      .join("\r\n"),
                  "text/csv;charset=utf-8",
                )
              }
            >
              导出订单 ↓
            </button>
          </header>
          <div className="pd-order-metrics">
            {[
              [String(orders.length), "全部订单"],
              [
                String(orders.filter((o) => o.status === "待处理").length),
                "待处理",
              ],
              [
                money(orders.reduce((n, o) => n + o.qty * o.price, 0)),
                "订单金额",
              ],
            ].map(([v, k], i) => (
              <article key={k}>
                <small>{k}</small>
                <strong>{v}</strong>
                <Sparkline
                  values={[12, 13, 14, 15].map((day) =>
                    orders
                      .filter((o) => o.date.endsWith(String(day)))
                      .reduce(
                        (n, o) =>
                          n +
                          (i === 2
                            ? o.qty * o.price
                            : i === 1
                              ? Number(o.status === "待处理")
                              : 1),
                        0,
                      ),
                  )}
                />
              </article>
            ))}
          </div>
          <section className="pd-order-table-card">
            <div className="pd-order-filters">
              <input
                aria-label="搜索订单"
                placeholder="搜索订单号、客户或商品…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
              />
              <Select
                label="订单状态"
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(0);
                }}
                options={["全部", "待处理", "已发货", "已完成"].map((s) => [
                  s,
                  s,
                ])}
              />
            </div>
            {selected.length > 0 && (
              <div className="pd-bulk">
                <span>已选择 {selected.length} 笔订单</span>
                <button
                  onClick={() => {
                    setOrders((v) =>
                      v.map((o) =>
                        selected.includes(o.id) && o.status === "待处理"
                          ? { ...o, status: "已发货" }
                          : o,
                      ),
                    );
                    setNote("已更新本地订单状态，没有创建物流或发货请求。");
                    setSelected([]);
                  }}
                >
                  模拟批量发货
                </button>
              </div>
            )}
            <div className="pd-table-scroll">
              <table aria-label="业务订单">
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label="选择本页全部订单"
                        type="checkbox"
                        checked={
                          visible.length > 0 &&
                          visible.every((o) => selected.includes(o.id))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [
                                  ...new Set([
                                    ...selected,
                                    ...visible.map((o) => o.id),
                                  ]),
                                ]
                              : selected.filter(
                                  (id) => !visible.some((o) => o.id === id),
                                ),
                          )
                        }
                      />
                    </th>
                    <th>订单 / 客户</th>
                    <th>商品</th>
                    <th>金额</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <input
                          aria-label={`选择订单${o.id}`}
                          type="checkbox"
                          checked={selected.includes(o.id)}
                          onChange={() =>
                            setSelected((v) =>
                              v.includes(o.id)
                                ? v.filter((id) => id !== o.id)
                                : [...v, o.id],
                            )
                          }
                        />
                      </td>
                      <td>
                        <strong>{o.id}</strong>
                        <small>{o.customer}</small>
                      </td>
                      <td>
                        {o.product}
                        <small>
                          {o.qty} 件 · {o.date}
                        </small>
                      </td>
                      <td>{money(o.qty * o.price)}</td>
                      <td>
                        <Badge
                          tone={
                            o.status === "待处理"
                              ? "amber"
                              : o.status === "已发货"
                                ? "blue"
                                : "green"
                          }
                        >
                          {o.status}
                        </Badge>
                      </td>
                      <td>
                        <button
                          aria-label={`查看订单${o.id}`}
                          onClick={() => setDetail(o.id)}
                        >
                          详情 ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visible.length && <p className="pd-empty">没有匹配的订单</p>}
            </div>
            <div className="pd-pagination">
              <small>{filtered.length} 笔订单</small>
              <div>
                <button disabled={!page} onClick={() => setPage((v) => v - 1)}>
                  上一页
                </button>
                <span>
                  {page + 1} / {Math.max(1, Math.ceil(filtered.length / 6))}
                </span>
                <button
                  disabled={(page + 1) * 6 >= filtered.length}
                  onClick={() => setPage((v) => v + 1)}
                >
                  下一页
                </button>
              </div>
            </div>
          </section>
          {note && (
            <p role="status" className="pd-feedback">
              {note}
            </p>
          )}
          {record && (
            <section className="pd-order-detail" aria-label="订单详情">
              <div className="pd-section-title">
                <h2>{record.id} · 订单详情</h2>
                <button onClick={() => setDetail(null)}>关闭详情</button>
              </div>
              <details className="ws-context-editor">
                <summary>编辑订单资料</summary>
                <fieldset
                  disabled={role === "只读"}
                  className="ws-two-columns"
                  style={{ border: 0, padding: 0 }}
                >
                  {(["customer", "product", "owner"] as const).map((key) => (
                    <Field
                      key={key}
                      label={
                        {
                          customer: "订单客户",
                          product: "订单商品",
                          owner: "订单负责人",
                        }[key]
                      }
                      value={record[key]}
                      onChange={(value) =>
                        setOrders((v) =>
                          v.map((o) =>
                            o.id === record.id ? { ...o, [key]: value } : o,
                          ),
                        )
                      }
                    />
                  ))}
                  <Field
                    label="订单单价"
                    type="number"
                    value={record.price}
                    min={0}
                    max={10000000}
                    onChange={(value) =>
                      setOrders((v) =>
                        v.map((o) =>
                          o.id === record.id
                            ? {
                                ...o,
                                price: Math.max(
                                  0,
                                  Math.min(10000000, Number(value) || 0),
                                ),
                              }
                            : o,
                        ),
                      )
                    }
                  />
                  <Field
                    label="订单数量"
                    type="number"
                    value={record.qty}
                    min={1}
                    max={999}
                    onChange={(value) =>
                      setOrders((v) =>
                        v.map((o) =>
                          o.id === record.id
                            ? {
                                ...o,
                                qty: Math.max(
                                  1,
                                  Math.min(999, Math.floor(Number(value) || 1)),
                                ),
                              }
                            : o,
                        ),
                      )
                    }
                  />
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "删除当前订单？可撤销；不会影响真实交易或库存。",
                        )
                      ) {
                        setOrders((v) => v.filter((o) => o.id !== record.id));
                        setDetail(null);
                        setSelected((v) => v.filter((id) => id !== record.id));
                        setPage(0);
                      }
                    }}
                  >
                    删除订单
                  </button>
                </fieldset>
              </details>
              <div className="pd-order-detail-grid">
                <img src={art.headphones} alt="订单商品耳机概念图" />
                <dl>
                  <div>
                    <dt>客户</dt>
                    <dd>{record.customer}</dd>
                  </div>
                  <div>
                    <dt>商品</dt>
                    <dd>
                      {record.product} × {record.qty}
                    </dd>
                  </div>
                  <div>
                    <dt>负责人</dt>
                    <dd>{record.owner}</dd>
                  </div>
                  <div>
                    <dt>金额</dt>
                    <dd>{money(record.price * record.qty)}</dd>
                  </div>
                  <div>
                    <dt>状态</dt>
                    <dd>{record.status}</dd>
                  </div>
                </dl>
                <div>
                  <h3>本地状态流转</h3>
                  <ol>
                    <li>订单已创建</li>
                    <li>
                      {record.status === "待处理"
                        ? "待确认库存"
                        : "本地发货状态已标记"}
                    </li>
                    <li>
                      {record.status === "已完成"
                        ? "订单完成"
                        : "等待下一步处理"}
                    </li>
                  </ol>
                  <button
                    disabled={
                      role === "只读" ||
                      record.status === "已完成" ||
                      record.status === "已取消"
                    }
                    onClick={() =>
                      setOrders((v) =>
                        v.map((o) =>
                          o.id === record.id
                            ? {
                                ...o,
                                status:
                                  o.status === "待处理" ? "已发货" : "已完成",
                              }
                            : o,
                        ),
                      )
                    }
                  >
                    模拟推进状态
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const apiOrders = initialOrders.slice(0, 3);
export function ApiStudio() {
  const [requests, setRequests] = useSceneState<
      {
        id: string;
        name: string;
        method: string;
        path: string;
        body: string;
        auth: boolean;
      }[]
    >("requests", []),
    [environment, setEnvironment] = useSceneState("environment", "AU-1048");
  const [requestName, setRequestName] = useState("我的订单请求"),
    [collectionMessage, setCollectionMessage] = useState("");
  const [method, setMethod] = useSceneState("method", "GET"),
    [path, setPath] = useSceneState("path", "/v1/orders/AU-1048"),
    [body, setBody] = useSceneState(
      "body",
      '{\n  "customer": "示例客户",\n  "product": "AURA ONE",\n  "quantity": 2\n}',
    ),
    [auth, setAuth] = useSceneState("auth", true),
    [tab, setTab] = useSceneState("tab", "响应正文"),
    [result, setResult] = useSceneState<{
      status: number;
      data: unknown;
    } | null>("result", null),
    [history, setHistory] = useSceneState<
      {
        method: string;
        path: string;
        status: number;
        body: string;
        auth: boolean;
        response: unknown;
      }[]
    >("history", []),
    [formTab, setFormTab] = useSceneState("formTab", "参数");
  function run() {
    const resolved = path.replaceAll("{{orderId}}", environment);
    const [requestPath, query] = resolved.split("?");
    const params = new URLSearchParams(query || "");
    let status = 200,
      data: unknown;
    if (!auth) {
      status = 401;
      data = { error: { code: "UNAUTHORIZED", message: "请携带演示身份" } };
    } else if (method === "POST" && requestPath !== "/v1/orders") {
      status = 404;
      data = { error: { code: "NOT_FOUND", message: "未找到示例路由" } };
    } else if (method === "POST") {
      try {
        const parsed = JSON.parse(body);
        if (
          !parsed ||
          typeof parsed.customer !== "string" ||
          !parsed.customer.trim() ||
          !Number.isInteger(parsed.quantity) ||
          parsed.quantity < 1 ||
          parsed.quantity > 99
        ) {
          status = 422;
          data = {
            error: {
              code: "VALIDATION_ERROR",
              message: "customer 为必填文字，quantity 必须为 1–99 的整数",
            },
          };
        } else {
          status = 201;
          data = {
            id: "AU-LOCAL",
            customer: parsed.customer,
            quantity: parsed.quantity,
            status: "draft",
            persisted: false,
          };
        }
      } catch {
        status = 400;
        data = {
          error: { code: "INVALID_JSON", message: "请求正文不是有效的 JSON" },
        };
      }
    } else if (requestPath === "/v1/orders") {
      const selectedStatus = params.get("status");
      const list = apiOrders.filter(
        (o) => !selectedStatus || o.status === selectedStatus,
      );
      data = { data: list, total: list.length };
    } else {
      const order = apiOrders.find((o) => `/v1/orders/${o.id}` === requestPath);
      if (order) data = { data: order };
      else {
        status = 404;
        data = { error: { code: "NOT_FOUND", message: "未找到示例资源" } };
      }
    }
    setResult({ status, data });
    setHistory((v) =>
      [
        { method, path: resolved, status, body, auth, response: data },
        ...v,
      ].slice(0, 20),
    );
  }
  return (
    <div className="pd-api">
      <Toolbar brand="ENDPOINT" title="API WORKSPACE">
        <Badge tone="blue">LOCAL MOCK</Badge>
        <span>无需网络 · 不执行外部请求</span>
      </Toolbar>
      <div className="pd-api-layout">
        <aside className="pd-api-collections">
          <small>COLLECTIONS</small>
          <h3>▾ Commerce API</h3>
          {[
            ["GET", "订单列表", "/v1/orders"],
            ["GET", "订单详情", "/v1/orders/AU-1048"],
            ["POST", "创建订单", "/v1/orders"],
          ].map(([m, t, p]) => (
            <button
              key={t}
              aria-pressed={method === m && path === p}
              onClick={() => {
                setMethod(m);
                setPath(p);
                setResult(null);
              }}
            >
              <b>{m}</b>
              {t}
            </button>
          ))}
          <h3>我的请求集合</h3>
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setMethod(r.method);
                setPath(r.path);
                setBody(r.body);
                setAuth(r.auth);
                setResult(null);
              }}
            >
              <b>{r.method}</b>
              {r.name}
            </button>
          ))}
          <h3>响应历史 · 可载入</h3>
          {history.map((h, i) => (
            <button
              className="pd-api-history"
              key={i}
              onClick={() => {
                setMethod(h.method);
                setPath(h.path);
                setBody(h.body || body);
                setAuth(h.auth ?? auth);
                setResult({ status: h.status, data: h.response });
              }}
            >
              <Badge tone={h.status < 300 ? "green" : "amber"}>
                {h.status}
              </Badge>
              <small>
                {h.method} {h.path}
              </small>
            </button>
          ))}
        </aside>
        <section className="pd-api-main">
          <h1>订单接口调试</h1>
          <div className="ws-request-list">
            <label>
              环境变量 orderId{" "}
              <input
                aria-label="环境变量 orderId"
                value={environment}
                maxLength={80}
                onChange={(e) => setEnvironment(e.target.value)}
              />
            </label>
            <small>路径支持 {"{{orderId}}"}；列表支持 ?status=待处理</small>
          </div>
          <div className="pd-request-url">
            <select
              aria-label="HTTP 方法"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option>GET</option>
              <option>POST</option>
            </select>
            <input
              aria-label="接口路径"
              value={path}
              maxLength={100}
              onChange={(e) => setPath(e.target.value)}
            />
            <button className="pd-primary" onClick={run}>
              运行模拟 ↗
            </button>
          </div>
          <div className="ws-request-list">
            <input
              aria-label="请求名称"
              value={requestName}
              maxLength={60}
              onChange={(e) => setRequestName(e.target.value)}
            />
            <button
              disabled={requests.length >= 20}
              onClick={() => {
                if (!requestName.trim()) {
                  setCollectionMessage("请填写请求名称。");
                  return;
                }
                setRequests((v) => [
                  ...v,
                  {
                    id: crypto.randomUUID(),
                    name: requestName.trim(),
                    method,
                    path,
                    body,
                    auth,
                  },
                ]);
                setCollectionMessage("请求已保存到当前集合。");
              }}
            >
              保存请求
            </button>
            <button
              disabled={!requests.length}
              onClick={() =>
                downloadText(
                  "api-collection.json",
                  JSON.stringify(
                    {
                      name: "Commerce API",
                      mode: "local-mock",
                      variables: { orderId: environment },
                      requests,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              导出集合
            </button>
            <span role="status">{collectionMessage}</span>
          </div>
          <div className="pd-code-tabs">
            {["参数", "身份", "正文"].map((t) => (
              <button
                key={t}
                aria-pressed={formTab === t}
                onClick={() => setFormTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {formTab === "身份" ? (
            <div className="pd-api-auth">
              <label>
                <input
                  type="checkbox"
                  checked={auth}
                  onChange={(e) => setAuth(e.target.checked)}
                />
                携带演示身份
              </label>
              <p>用于测试 401 状态，不需要或保存真实 API 密钥。</p>
            </div>
          ) : formTab === "正文" ? (
            <Field
              label="JSON 请求正文"
              value={body}
              onChange={setBody}
              multiline
            />
          ) : (
            <table aria-label="接口参数">
              <thead>
                <tr>
                  <th>参数</th>
                  <th>类型</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>orderId</td>
                  <td>string</td>
                  <td>GET /v1/orders/AU-1048</td>
                </tr>
                <tr>
                  <td>customer</td>
                  <td>string</td>
                  <td>POST 时必填</td>
                </tr>
                <tr>
                  <td>quantity</td>
                  <td>integer</td>
                  <td>POST 时范围 1–99</td>
                </tr>
              </tbody>
            </table>
          )}
          <div className="pd-api-response">
            <div className="pd-section-title">
              <div className="pd-code-tabs">
                {["响应正文", "响应头"].map((t) => (
                  <button
                    key={t}
                    aria-pressed={tab === t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {result ? (
                <Badge tone={result.status < 300 ? "green" : "amber"}>
                  {result.status} {result.status < 300 ? "SUCCESS" : "ERROR"}
                </Badge>
              ) : (
                <Badge tone="neutral">等待运行</Badge>
              )}
            </div>
            <pre aria-label="接口响应">
              {tab === "响应头"
                ? "content-type: application/json\nx-demo-mode: local\ncache-control: no-store"
                : result
                  ? JSON.stringify(result.data, null, 2)
                  : '{\n  "message": "点击运行模拟，查看响应正文与状态码"\n}'}
            </pre>
          </div>
          <footer>
            固定路由的本地模拟器 · 可验证 200 / 201 / 400 / 401 / 404 / 422
          </footer>
        </section>
      </div>
    </div>
  );
}

const issueNames = [
  "空值用户导致崩溃",
  "负数金额越过校验",
  "空列表产生无效均值",
];
export function DebugStudio() {
  const [issue, setIssue] = useSceneState("issue", 0),
    [fixed, setFixed] = useSceneState("fixed", false),
    [input, setInput] = useSceneState("input", "null"),
    [result, setResult] = useSceneState("result", ""),
    [stack, setStack] = useSceneState("stack", false);
  const source = [
    fixed
      ? 'export function displayName(user) {\n  return user?.name?.trim() || "匿名用户";\n}'
      : "export function displayName(user) {\n  return user.name.trim();\n}",
    fixed
      ? "export function discounted(price) {\n  return Math.round(Math.max(0, price) * 90) / 100;\n}"
      : "export function discounted(price) {\n  return Math.round(price * 90) / 100;\n}",
    fixed
      ? "export function average(values) {\n  if (!values.length) return 0;\n  return values.reduce((a, b) => a + b, 0) / values.length;\n}"
      : "export function average(values) {\n  return values.reduce((a, b) => a + b, 0) / values.length;\n}",
  ][issue];
  const baseline = [
    "export function displayName(user) {\n  return user.name.trim();\n}",
    "export function discounted(price) {\n  return Math.round(price * 90) / 100;\n}",
    "export function average(values) {\n  return values.reduce((a, b) => a + b, 0) / values.length;\n}",
  ][issue];
  const file = ["user.ts", "pricing.ts", "average.ts"][issue];
  const patch = `--- a/${file}\n+++ b/${file}\n@@ -1,${baseline.split("\n").length} +1,${source.split("\n").length} @@\n${baseline
    .split("\n")
    .map((l) => "-" + l)
    .join("\n")}\n${source
    .split("\n")
    .map((l) => "+" + l)
    .join("\n")}\n`;
  function run() {
    try {
      let out: unknown;
      if (issue === 0) {
        const v: { name?: string } | null =
          input === "valid"
            ? { name: " 林晓 " }
            : input === "empty"
              ? {}
              : null;
        out = fixed ? v?.name?.trim() || "匿名用户" : v!.name!.trim();
      } else if (issue === 1) {
        const n = input === "valid" ? 100 : -10;
        out = Math.round((fixed ? Math.max(0, n) : n) * 90) / 100;
      } else {
        const arr = input === "valid" ? [2, 4, 6] : [];
        out =
          fixed && !arr.length
            ? 0
            : arr.reduce((a, b) => a + b, 0) / arr.length;
      }
      setResult(`执行结果：${String(out)}`);
      setStack(false);
    } catch {
      setResult("TypeError: Cannot read properties of null / undefined");
      setStack(true);
    }
  }
  return (
    <div className="pd-debug">
      <Toolbar brand="TRACE /" title="问题诊断工作台">
        <Badge tone="amber">3 个待复核问题</Badge>
        <span>内置函数运行 · 不执行用户代码</span>
        <button
          disabled={!fixed}
          onClick={() =>
            downloadText(
              "boundary-fix.patch",
              patch,
              "text/x-diff;charset=utf-8",
            )
          }
        >
          导出修复补丁
        </button>
        <button
          onClick={() => downloadText(file, source, "text/plain;charset=utf-8")}
        >
          下载当前源码
        </button>
      </Toolbar>
      <div className="pd-debug-layout">
        <aside>
          <small>ISSUE EXPLORER</small>
          {issueNames.map((n, i) => (
            <button
              key={n}
              aria-pressed={issue === i}
              onClick={() => {
                setIssue(i);
                setFixed(false);
                setInput("null");
                setResult("");
                setStack(false);
              }}
            >
              <span>#{241 + i}</span>
              <strong>{n}</strong>
              <small>
                {
                  [
                    "TypeError / user.ts:2",
                    "Validation / pricing.ts:2",
                    "NaN / statistics.ts:2",
                  ][i]
                }
              </small>
            </button>
          ))}
          <div className="pd-debug-summary">
            <h3>定位 → 修复 → 验证</h3>
            <p>
              先保留失败输入，再验证修复是否覆盖边界，避免只对正常数据有效。
            </p>
          </div>
        </aside>
        <section>
          <header className="pd-debug-title">
            <div>
              <Badge tone={fixed ? "green" : "amber"}>
                {fixed ? "修复版本" : "原始版本"}
              </Badge>
              <h1>{issueNames[issue]}</h1>
            </div>
            <button
              onClick={() => {
                setFixed((v) => !v);
                setResult("");
              }}
            >
              {fixed ? "还原问题代码" : "应用建议修复"}
            </button>
          </header>
          <div className="pd-editor-title">
            <span>
              src / {["user.ts", "pricing.ts", "statistics.ts"][issue]}
            </span>
            <small>TypeScript · 只读内置示例</small>
          </div>
          <div className="pd-code-editor">
            {source.split("\n").map((line, i) => (
              <div className={!fixed && i === 1 ? "error-line" : ""} key={i}>
                <span>{i + 1}</span>
                <code>{line}</code>
              </div>
            ))}
          </div>
          <div className="pd-debug-rationale">
            <strong>根因分析</strong>
            <p>
              {
                [
                  "未验证 user 与 name 的存在性，直接访问属性并调用 trim，在空值输入下抛出异常。",
                  "输入边界没有限制为非负数，导致折扣后仍可能返回负金额。",
                  "空列表的长度为 0，直接除以列表长度会返回 NaN，而不是明确的空态结果。",
                ][issue]
              }
            </p>
          </div>
          <details className="ws-context-editor">
            <summary>查看修复前后差异</summary>
            <div className="ws-two-columns">
              <pre>{baseline}</pre>
              <pre>{source}</pre>
            </div>
          </details>
          <div className="pd-run-panel">
            <Select
              label="运行输入"
              value={input}
              onChange={(v) => {
                setInput(v);
                setResult("");
              }}
              options={
                issue === 0
                  ? [
                      ["null", "null / 空值"],
                      ["empty", "{} / 空对象"],
                      ["valid", "正常用户"],
                    ]
                  : issue === 1
                    ? [
                        ["null", "-10 / 负价格"],
                        ["valid", "100 / 正常价格"],
                      ]
                    : [
                        ["null", "[] / 空列表"],
                        ["valid", "[2, 4, 6]"],
                      ]
              }
            />
            <button className="pd-primary" onClick={run}>
              ▶ 运行案例
            </button>
          </div>
          <div
            className={`pd-terminal ${stack ? "has-error" : ""}`}
            role="status"
          >
            <small>OUTPUT / LOCAL RUNTIME</small>
            <pre>{result || "选择输入，运行原始或修复后的内置函数。"}</pre>
            {stack && (
              <code>
                at displayName (user.ts:2:15)
                <br />
                at localCaseRunner (runner.ts:1:1)
              </code>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const suites = {
  price: [
    { name: "正常价格", input: 100, expected: 90 },
    { name: "零值价格", input: 0, expected: 0 },
    { name: "负数边界", input: -10, expected: 0 },
    { name: "小数四舍五入", input: 19.99, expected: 17.99 },
  ],
  quantity: [
    { name: "单件订单", input: 1, expected: 1 },
    { name: "零件订单", input: 0, expected: 1 },
    { name: "数量超限", input: 120, expected: 99 },
    { name: "小数数量", input: 2.5, expected: 2 },
  ],
};
export function TestStudio() {
  const [customCases, setCustomCases] = useSceneState<
    {
      suite: "price" | "quantity";
      name: string;
      input: number;
      expected: number;
    }[]
  >("customCases", []);
  const [caseName, setCaseName] = useState("我的边界用例"),
    [caseInput, setCaseInput] = useState("-5"),
    [caseExpected, setCaseExpected] = useState("0"),
    [caseError, setCaseError] = useState("");
  const [suite, setSuite] = useSceneState<"price" | "quantity">(
      "suite",
      "price",
    ),
    [fixed, setFixed] = useSceneState("fixed", false),
    [results, setResults] = useSceneState<
      { actual: number; ok: boolean }[] | null
    >("results", null),
    [selected, setSelected] = useSceneState("selected", 0),
    [elapsed, setElapsed] = useSceneState("elapsed", 0);
  const cases = [
    ...suites[suite],
    ...customCases.filter((c) => c.suite === suite),
  ];
  function run() {
    const start = performance.now();
    setResults(
      cases.map((t) => {
        const actual =
          suite === "price"
            ? Math.round((fixed ? Math.max(0, t.input) : t.input) * 90) / 100
            : fixed
              ? Math.min(99, Math.max(1, Math.floor(t.input)))
              : t.input;
        return { actual, ok: actual === t.expected };
      }),
    );
    setElapsed(performance.now() - start);
  }
  return (
    <div className="pd-test-studio">
      <Toolbar brand="CHECKPOINT" title="质量验证 / 订单计算模块">
        <button className="pd-primary" onClick={run}>
          ▶ 运行测试
        </button>
        <button
          disabled={!results}
          onClick={() =>
            downloadText(
              "test-report.json",
              JSON.stringify(
                {
                  suite,
                  fixed,
                  elapsed,
                  cases: cases.map((c, i) => ({ ...c, ...results?.[i] })),
                  scope:
                    "Browser execution of the listed built-in functions, not arbitrary source code",
                },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          导出测试报告
        </button>
      </Toolbar>
      <div className="pd-test-layout">
        <aside>
          <small>TEST SUITES</small>
          {(
            [
              ["price", "pricing.spec.ts"],
              ["quantity", "quantity.spec.ts"],
            ] as const
          ).map(([id, name]) => (
            <button
              key={id}
              aria-pressed={suite === id}
              onClick={() => {
                setSuite(id);
                setResults(null);
                setSelected(0);
                setFixed(false);
              }}
            >
              <span>◇</span>
              <div>
                <strong>{name}</strong>
                <small>4 tests / unit</small>
              </div>
            </button>
          ))}
          <div className="pd-test-coverage">
            <strong>8</strong>
            <small>预设测试用例</small>
            <p>价格计算与数量边界，两组独立的实际本地断言。</p>
          </div>
        </aside>
        <section>
          <header>
            <small>TEST RUNNER / LOCAL EXECUTION</small>
            <h1>{suite === "price" ? "价格计算单元测试" : "订单数量校验"}</h1>
            <label>
              <input
                type="checkbox"
                checked={fixed}
                onChange={(e) => {
                  setFixed(e.target.checked);
                  setResults(null);
                }}
              />
              启用边界修复
            </label>
          </header>
          <div className="pd-test-metrics" role="status">
            <div>
              <strong>
                {results ? results.filter((r) => r.ok).length : "—"}
              </strong>
              <small>通过</small>
            </div>
            <div>
              <strong>
                {results ? results.filter((r) => !r.ok).length : "—"}
              </strong>
              <small>失败</small>
            </div>
            <div>
              <strong>{results ? `${elapsed.toFixed(2)} ms` : "—"}</strong>
              <small>本地执行耗时</small>
            </div>
            <span>
              {results
                ? `${results.filter((r) => r.ok).length} / ${cases.length} 通过`
                : "等待运行"}
            </span>
          </div>
          <div className="pd-table-scroll">
            <table aria-label="测试用例结果">
              <thead>
                <tr>
                  <th>测试用例</th>
                  <th>输入</th>
                  <th>预期</th>
                  <th>实际</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((t, i) => (
                  <tr className={selected === i ? "selected" : ""} key={t.name}>
                    <td>
                      <button onClick={() => setSelected(i)}>{t.name}</button>
                    </td>
                    <td>{t.input}</td>
                    <td>{t.expected}</td>
                    <td>{results?.[i]?.actual ?? "—"}</td>
                    <td>
                      <Badge
                        tone={
                          !results
                            ? "neutral"
                            : results[i]?.ok
                              ? "green"
                              : "red"
                        }
                      >
                        {!results ? "未运行" : results[i]?.ok ? "通过" : "失败"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="ws-test-case-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !caseName.trim() ||
                !caseInput.trim() ||
                !caseExpected.trim() ||
                !Number.isFinite(+caseInput) ||
                !Number.isFinite(+caseExpected)
              ) {
                setCaseError("名称、输入和预期必须有效。");
                return;
              }
              setCustomCases((v) => [
                ...v,
                {
                  suite,
                  name: caseName.trim(),
                  input: +caseInput,
                  expected: +caseExpected,
                },
              ]);
              setResults(null);
              setCaseError("用例已加入，点击运行测试验证。");
            }}
          >
            <label>
              用例名称
              <input
                aria-label="自定义用例名称"
                value={caseName}
                maxLength={60}
                onChange={(e) => setCaseName(e.target.value)}
              />
            </label>
            <label>
              输入
              <input
                aria-label="自定义用例输入"
                type="number"
                step="any"
                value={caseInput}
                onChange={(e) => setCaseInput(e.target.value)}
              />
            </label>
            <label>
              预期
              <input
                aria-label="自定义用例预期"
                type="number"
                step="any"
                value={caseExpected}
                onChange={(e) => setCaseExpected(e.target.value)}
              />
            </label>
            <button disabled={customCases.length >= 40}>添加用例</button>
            <small role="status">{caseError}</small>
          </form>
          <div className="pd-assertion">
            <header>
              <strong>{cases[selected].name}</strong>
              <small>ASSERTION DETAIL</small>
            </header>
            <pre>{`test("${cases[selected].name}", () => {\n  const result = ${suite === "price" ? "discounted" : "validateQuantity"}(${cases[selected].input});\n  expect(result).toBe(${cases[selected].expected});\n});`}</pre>
            {results && !results[selected]?.ok && (
              <p>
                Expected: {cases[selected].expected}　Received:{" "}
                {results[selected]?.actual}　— 检查输入边界处理。
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
