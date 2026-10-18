import { readTable, exportXlsx } from "./tabular";
import { useSceneState } from "./workspace";
import { useMemo, useState } from "react";
import {
  art,
  Avatar,
  Badge,
  Field,
  Select,
  Toolbar,
  Sparkline,
  TrendChart,
  downloadText,
  csvCell,
  money,
  numberInput,
  type DemoProps,
} from "./shared";

export function Meeting({ interactive }: DemoProps) {
  const [title, setTitle] = useSceneState("title", "AURA ONE · 产品发布评审");
  const [notes, setNotes] = useSceneState(
    "notes",
    "本次评审确认以「专注每一段声音」为产品叙事，优先展示主动降噪、长续航与轻量佩戴三个价值点。首发页面采用实物摄影，不使用功能示意图替代产品图片。\n首批上线范围包含产品首页、规格对比和售后说明。会员积分与海外配送移入第二阶段，避免首发链路过长。",
  );
  const [tasks, setTasks] = useSceneState("tasks", [
    {
      text: "完善产品规格与电池说明",
      owner: "林晓",
      date: "10.19",
      done: true,
    },
    {
      text: "提交首页实物摄影与移动端稿",
      owner: "陈宁",
      date: "10.20",
      done: false,
    },
    {
      text: "校验首发优惠及退换货条款",
      owner: "周远",
      date: "10.21",
      done: false,
    },
  ]);
  const [decision, setDecision] = useSceneState(
    "decision",
    "10 月 28 日上线第一阶段内容，范围优先于功能数量，信息准确优先于宣传密度。",
  );
  const [source, setSource] = useSceneState(
    "source",
    "产品评审会 · 2026-10-16 · 林晓、陈宁、周远、王栩",
  );
  const [newTask, setNewTask] = useSceneState("newTask", "");
  const [section, setSection] = useSceneState("section", "纪要正文");
  return (
    <div className="pd-meeting">
      <Toolbar brand="PAPER /" title="产品组 / 会议记录">
        <Badge>本地纪要</Badge>
        <button
          onClick={() =>
            downloadText(
              "meeting-notes.md",
              `# ${title}\n\n${notes}\n\n## 行动事项\n${tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.text} / ${t.owner} / ${t.date}`).join("\n")}`,
            )
          }
        >
          导出纪要 ↓
        </button>
      </Toolbar>
      <div className="pd-document-workspace">
        <aside className="pd-document-outline">
          <small>本篇目录</small>
          {["纪要正文", "行动事项", "会议资料"].map((s) => (
            <button
              key={s}
              aria-pressed={section === s}
              onClick={() => setSection(s)}
            >
              {s}
            </button>
          ))}
          <div className="pd-note-card">
            <span>03</span>
            <small>产品发布评审</small>
            <p>
              版本 1.0
              <br />
              10 月 16 日 · 14:00
            </p>
          </div>
        </aside>
        <article className="pd-meeting-paper">
          <div className="pd-document-kicker">
            PRODUCT REVIEW / MEETING NOTES
          </div>
          {interactive ? (
            <Field label="纪要标题" value={title} onChange={setTitle} />
          ) : (
            <h1>{title}</h1>
          )}
          <div className="pd-meeting-meta">
            <span>2026.10.16　14:00–15:00</span>
            <span>主持人：林晓</span>
            <span>记录人：陈宁</span>
          </div>
          <div className="pd-participants">
            <span>与会成员</span>
            {["林晓", "陈宁", "周远", "王栩"].map((n, i) => (
              <span key={n}>
                <Avatar name={n} index={i} />
                {n}
              </span>
            ))}
          </div>
          {section === "会议资料" ? (
            <div className="pd-material">
              <img src={art.headphones} alt="AURA ONE 耳机产品视觉概念" />
              <h2>产品发布视觉方向</h2>
              {interactive && (
                <Field
                  label="会议来源与参会者"
                  value={source}
                  onChange={setSource}
                />
              )}
              <p>
                深石墨色产品摄影作为首屏；下方用对比表说明规格，不将营销口号当作技术参数。
              </p>
              <small>AI 生成的虚构产品视觉，用于界面展示。</small>
            </div>
          ) : (
            <>
              {section === "纪要正文" && (
                <>
                  <div className="pd-decision">
                    <strong>核心决策</strong>
                    {interactive ? (
                      <Field
                        label="核心决策"
                        value={decision}
                        onChange={setDecision}
                        multiline
                      />
                    ) : (
                      <p>{decision}</p>
                    )}
                  </div>
                  <h2>01　讨论结论</h2>
                  {interactive ? (
                    <Field
                      label="会议正文"
                      value={notes}
                      onChange={setNotes}
                      multiline
                    />
                  ) : (
                    <p className="pd-prose">{notes}</p>
                  )}
                  <h2>02　需要跟进的问题</h2>
                  <ul className="pd-document-list">
                    <li>续航数据的测试条件需要随规格一起披露。</li>
                    <li>移动端购买入口需在长页浏览后仍可触达。</li>
                  </ul>
                </>
              )}
              <div className="pd-section-title">
                <h2>03　行动事项</h2>
                <Badge>
                  {tasks.filter((t) => t.done).length} / {tasks.length} 已完成
                </Badge>
              </div>
              <div className="pd-table-scroll">
                <table aria-label="会议行动事项">
                  <thead>
                    <tr>
                      <th>状态</th>
                      <th>事项</th>
                      <th>负责人</th>
                      <th>截止</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            aria-label={`完成${task.text}`}
                            type="checkbox"
                            checked={task.done}
                            onChange={() =>
                              setTasks((v) =>
                                v.map((t, n) =>
                                  n === i ? { ...t, done: !t.done } : t,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          {interactive ? (
                            <input
                              aria-label={`行动事项${i + 1}`}
                              value={task.text}
                              maxLength={160}
                              onChange={(e) =>
                                setTasks((v) =>
                                  v.map((t, n) =>
                                    n === i
                                      ? { ...t, text: e.target.value }
                                      : t,
                                  ),
                                )
                              }
                            />
                          ) : (
                            task.text
                          )}
                        </td>
                        <td>
                          {interactive ? (
                            <input
                              aria-label={`负责人${i + 1}`}
                              value={task.owner}
                              maxLength={30}
                              onChange={(e) =>
                                setTasks((v) =>
                                  v.map((t, n) =>
                                    n === i
                                      ? { ...t, owner: e.target.value }
                                      : t,
                                  ),
                                )
                              }
                            />
                          ) : (
                            task.owner
                          )}
                        </td>
                        <td>
                          {interactive ? (
                            <input
                              aria-label={`截止日期${i + 1}`}
                              value={task.date}
                              maxLength={20}
                              onChange={(e) =>
                                setTasks((v) =>
                                  v.map((t, n) =>
                                    n === i
                                      ? { ...t, date: e.target.value }
                                      : t,
                                  ),
                                )
                              }
                            />
                          ) : (
                            task.date
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {interactive && (
                <form
                  className="pd-inline-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newTask.trim() && tasks.length < 20) {
                      setTasks((v) => [
                        ...v,
                        {
                          text: newTask.trim(),
                          owner: "待分配",
                          date: "待确认",
                          done: false,
                        },
                      ]);
                      setNewTask("");
                    }
                  }}
                >
                  <input
                    aria-label="新增行动事项"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    maxLength={100}
                    placeholder="新增行动事项…"
                  />
                  <button disabled={!newTask.trim() || tasks.length >= 20}>
                    添加事项
                  </button>
                </form>
              )}
            </>
          )}
          <footer className="pd-document-footer">
            设计产品组 · 内部评审记录 <span>示例文档 / LOCAL</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

export function Weekly({ interactive }: DemoProps) {
  const [title, setTitle] = useSceneState("title", "第 42 周 · 产品交付周报");
  const [body, setBody] = useSceneState(
    "body",
    "本周完成品牌站核心页面交付，支付流程的边界状态已补齐。可访问性检查发现的 3 项问题进入下周迭代。新用户访谈验证了简化导航的方向，下一步将重点打磨移动端体验。",
  );
  const [completed, setCompleted] = useSceneState("completed", 8),
    [target, setTarget] = useSceneState("target", 10);
  const [done, setDone] = useSceneState("done", [true, true, false, false]);
  const [previous, setPrevious] = useSceneState("previous", 6),
    [team, setTeam] = useSceneState("team", "产品设计组"),
    [project, setProject] = useSceneState("project", "品牌站交付"),
    [source, setSource] = useSceneState(
      "source",
      "团队任务清单 / 10 月 12–18 日",
    );
  const [risks, setRisks] = useSceneState(
      "risks",
      "支付测试环境回调稳定性，需要开发组复核。\n键盘导航与小屏文字对比度尚待验收。",
    ),
    [nextSteps, setNextSteps] = useSceneState(
      "nextSteps",
      "完成移动端核心路径可用性测试\n整理设计规范并完成组件交付\n针对首批反馈安排小版本迭代",
    ),
    [delivered, setDelivered] = useSceneState(
      "delivered",
      "官网 / 支付 / 账户",
    );
  const progress = target ? Math.round((completed / target) * 100) : 0;
  return (
    <div className="pd-weekly">
      <Toolbar brand="PULSE" title={`团队周报 / ${team}`}>
        <span>10.12 — 10.18</span>
        <button
          onClick={() =>
            downloadText(
              "weekly-report.txt",
              `${title}\n完成 ${completed}/${target}（${progress}%）\n\n${body}`,
            )
          }
        >
          导出周报 ↓
        </button>
      </Toolbar>
      <div className="pd-weekly-body">
        {interactive && (
          <details className="ws-context-editor">
            <summary>项目、团队与数据来源</summary>
            <div className="ws-two-columns">
              <Field label="周报团队" value={team} onChange={setTeam} />
              <Field label="周报项目" value={project} onChange={setProject} />
              <Field label="数据来源" value={source} onChange={setSource} />
              <Field
                label="交付模块（用 / 分隔）"
                value={delivered}
                onChange={setDelivered}
              />
              <Field
                label="上期完成数量"
                type="number"
                value={String(previous)}
                onChange={(v) => setPrevious(Math.floor(numberInput(v, 9999)))}
              />
            </div>
          </details>
        )}
        <header className="pd-report-heading">
          <div>
            <small>WEEKLY BUSINESS REVIEW</small>
            <h1>{title}</h1>
            <small>
              {team} / {project}
            </small>
            <p>以交付为线索，追踪进展、风险与下一步行动。</p>
          </div>
          <span className="pd-week-number">W42</span>
        </header>
        <div className="pd-report-metrics">
          {[
            [
              `${completed}/${target}`,
              "事项完成",
              `${completed - previous >= 0 ? "+" : ""}${completed - previous} 较上期`,
            ],
            [`${progress}%`, "目标完成率", "根据当前输入计算"],
            [
              String(delivered.split("/").filter((v) => v.trim()).length),
              "已交付模块",
              delivered,
            ],
            [
              String(risks.split("\n").filter((v) => v.trim()).length),
              "待解决风险",
              "根据风险清单计算",
            ],
          ].map(([v, label, sub], i) => (
            <article key={label}>
              <small>{label}</small>
              <strong>{v}</strong>
              <span>{sub}</span>
              <Sparkline
                values={[3, 5, 4, 6, 7, i === 0 ? completed : 9]}
                color={i === 3 ? "#bb9867" : "#598a78"}
              />
            </article>
          ))}
        </div>
        <div className="pd-weekly-grid">
          <section className="pd-report-card">
            <div className="pd-section-title">
              <h2>交付趋势</h2>
              <small>本季度 · 示例记录</small>
            </div>
            <TrendChart
              values={[4, 6, 5, 8, 7, 9, 8, completed]}
              label="季度每周交付数量趋势"
              axisLabels={Array.from({ length: 8 }, (_, i) => `W${35 + i}`)}
            />
            <div className="pd-chart-legend">
              <i />
              实际交付 <span>数据口径：每周验收通过事项</span>
            </div>
          </section>
          <section className="pd-report-card">
            <h2>本周里程碑</h2>
            <div className="pd-milestones">
              {[
                "品牌首页完成评审",
                "支付状态完成联调",
                "移动端适配复核",
                "可访问性验收",
              ].map((label, i) => (
                <label key={label}>
                  <input
                    type="checkbox"
                    checked={done[i]}
                    onChange={() =>
                      setDone((v) => v.map((n, j) => (i === j ? !n : n)))
                    }
                  />
                  <div>
                    <strong>{label}</strong>
                    <small>
                      {
                        [
                          "周一 · 陈宁",
                          "周三 · 林晓",
                          "周五 · 周远",
                          "下周一 · 王栩",
                        ][i]
                      }
                    </small>
                  </div>
                  <Badge tone={done[i] ? "green" : "amber"}>
                    {done[i] ? "完成" : "待办"}
                  </Badge>
                </label>
              ))}
            </div>
          </section>
        </div>
        <section className="pd-report-card">
          <div className="pd-section-title">
            <h2>执行摘要</h2>
            <Badge tone="neutral">产品负责人 / 林晓</Badge>
          </div>
          {interactive ? (
            <>
              <Field label="周报标题" value={title} onChange={setTitle} />
              <Field
                label="周报内容"
                value={body}
                onChange={setBody}
                multiline
              />
              <div className="pd-form-row">
                <Field
                  label="完成数量"
                  value={completed}
                  type="number"
                  min={0}
                  max={999}
                  onChange={(v) => setCompleted(numberInput(v, 999))}
                />
                <Field
                  label="目标数量"
                  value={target}
                  type="number"
                  min={0}
                  max={999}
                  onChange={(v) => setTarget(numberInput(v, 999))}
                />
              </div>
            </>
          ) : (
            <p>{body}</p>
          )}
        </section>
        <div className="pd-weekly-grid">
          <section className="pd-report-card">
            <h2>风险与依赖</h2>
            {interactive ? (
              <Field
                label="风险清单"
                value={risks}
                onChange={setRisks}
                multiline
              />
            ) : (
              risks.split("\n").map((v, i) => <p key={i}>{v}</p>)
            )}
          </section>
          <section className="pd-report-card">
            <h2>下周计划</h2>
            {interactive ? (
              <Field
                label="下周计划"
                value={nextSteps}
                onChange={setNextSteps}
                multiline
              />
            ) : (
              <ol>
                {nextSteps.split("\n").map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <small className="pd-disclaimer">
          示例业务数据，用于演示报表结构与交互，不代表真实经营结果。
        </small>
      </div>
    </div>
  );
}

const initialSales = Array.from({ length: 18 }, (_, i) => ({
  id: `SL-${2601 + i}`,
  month: i < 6 ? "07" : i < 12 ? "08" : "09",
  channel: ["官网", "品牌门店", "渠道合作"][i % 3],
  region: ["华东", "华北", "华南"][(i + Math.floor(i / 3)) % 3],
  orders: [
    86, 64, 112, 95, 78, 135, 106, 91, 148, 114, 103, 163, 137, 108, 172, 153,
    125, 196,
  ][i],
  price: [899, 849, 799][i % 3],
  returns: (i % 4) + 1,
}));
export function DataScene() {
  const [importMessage, setImportMessage] = useState("");
  const [rows, setRows] = useSceneState("rows", initialSales),
    [month, setMonth] = useSceneState("month", "all"),
    [channel, setChannel] = useSceneState("channel", "all"),
    [sort, setSort] = useSceneState("sort", "id"),
    [page, setPage] = useSceneState("page", 0);
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (month === "all" || r.month === month) &&
            (channel === "all" || r.channel === channel),
        )
        .sort((a, b) =>
          sort === "revenue"
            ? b.orders * b.price - a.orders * a.price
            : a.id.localeCompare(b.id),
        ),
    [rows, month, channel, sort],
  );
  const revenue = filtered.reduce((n, r) => n + r.orders * r.price, 0),
    orders = filtered.reduce((n, r) => n + r.orders, 0),
    returns = filtered.reduce((n, r) => n + r.returns, 0);
  const totals = ["官网", "品牌门店", "渠道合作"].map((name) => ({
    name,
    value: filtered
      .filter((r) => r.channel === name)
      .reduce((n, r) => n + r.orders * r.price, 0),
  }));
  return (
    <div className="pd-analytics">
      {importMessage && (
        <p className="ws-inline-status" role="status">
          {importMessage}
        </p>
      )}
      <Toolbar brand="METRIC /" title="经营分析工作台">
        <Badge>本地数据集</Badge>
        <label className="ws-upload">
          导入 CSV / XLSX
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const table = await readTable(f);
                if (
                  table[0]?.join(",") !==
                  "记录编号,月份,渠道,区域,订单数,均价,退款单"
                )
                  throw new Error(
                    "请使用导出数据表的 7 列：记录编号、月份、渠道、区域、订单数、均价、退款单。",
                  );
                const seen = new Set<string>();
                const parsed = table.slice(1).map((r, i) => {
                  const nums = [r[4], r[5], r[6]].map(Number);
                  if (
                    r.length !== 7 ||
                    !r[0] ||
                    seen.has(r[0]) ||
                    !/^\d{1,2}$/.test(r[1]) ||
                    +r[1] < 1 ||
                    +r[1] > 12 ||
                    !["官网", "品牌门店", "渠道合作"].includes(r[2]) ||
                    !r[3] ||
                    [r[4], r[5], r[6]].some((v) => !v?.trim()) ||
                    nums.some(
                      (n) => !Number.isFinite(n) || n < 0 || n > 10000000,
                    ) ||
                    !Number.isInteger(nums[0]) ||
                    !Number.isInteger(nums[2]) ||
                    nums[2] > nums[0]
                  )
                    throw new Error(
                      `第 ${i + 2} 行数据不合法、退款超过订单或编号重复。`,
                    );
                  seen.add(r[0]);
                  return {
                    id: r[0],
                    month: r[1].padStart(2, "0"),
                    channel: r[2],
                    region: r[3],
                    orders: nums[0],
                    price: nums[1],
                    returns: nums[2],
                  };
                });
                if (!parsed.length) throw new Error("没有可导入的行。");
                if (confirm(`替换为 ${parsed.length} 条销售数据？可撤销。`)) {
                  setRows(parsed);
                  setPage(0);
                  setMonth("all");
                  setChannel("all");
                  setImportMessage(
                    `已导入 ${parsed.length} 条，指标与图表已更新。`,
                  );
                }
              } catch (err) {
                setImportMessage((err as Error).message);
              }
            }}
          />
        </label>
        <button
          onClick={() =>
            exportXlsx([
              ["记录编号", "月份", "渠道", "区域", "订单数", "均价", "退款单"],
              ...rows.map((r) => [
                r.id,
                r.month,
                r.channel,
                r.region,
                r.orders,
                r.price,
                r.returns,
              ]),
            ])
          }
        >
          导出 XLSX
        </button>
        <button
          onClick={() =>
            downloadText(
              "channel-sales.csv",
              "\uFEFF" +
                [
                  [
                    "编号",
                    "月份",
                    "渠道",
                    "区域",
                    "订单数",
                    "均价",
                    "销售额",
                    "退款单",
                  ],
                  ...filtered.map((r) => [
                    r.id,
                    r.month,
                    r.channel,
                    r.region,
                    r.orders,
                    r.price,
                    r.orders * r.price,
                    r.returns,
                  ]),
                ]
                  .map((row) => row.map(csvCell).join(","))
                  .join("\r\n"),
              "text/csv;charset=utf-8",
            )
          }
        >
          导出 CSV ↓
        </button>
      </Toolbar>
      <div className="pd-analytics-body">
        <header className="pd-section-title">
          <div>
            <small>SALES INTELLIGENCE / CHANNEL PERFORMANCE</small>
            <h1>渠道销售分析</h1>
          </div>
          <div className="pd-filter-controls">
            <Select
              label="月份"
              value={month}
              onChange={(v) => {
                setMonth(v);
                setPage(0);
              }}
              options={[
                ["all", "全部月份"],
                ...[...new Set(rows.map((r) => r.month))]
                  .sort()
                  .map((m) => [m, `${Number(m)} 月`] as [string, string]),
              ]}
            />
            <Select
              label="渠道"
              value={channel}
              onChange={(v) => {
                setChannel(v);
                setPage(0);
              }}
              options={[
                ["all", "全部渠道"],
                ["官网", "官网"],
                ["品牌门店", "品牌门店"],
                ["渠道合作", "渠道合作"],
              ]}
            />
          </div>
        </header>
        <div className="pd-analytics-metrics">
          {[
            [money(revenue), "销售额", "订单数 × 均价"],
            [orders.toLocaleString(), "有效订单", "当前筛选范围"],
            [
              money(orders ? revenue / orders : 0),
              "平均客单价",
              "销售额 / 订单数",
            ],
            [
              `${orders ? ((returns / orders) * 100).toFixed(2) : "0.00"}%`,
              "退款占比",
              "退款单 / 订单数",
            ],
          ].map(([n, label, sub]) => (
            <article key={label}>
              <small>{label}</small>
              <strong>{n}</strong>
              <span>{sub}</span>
            </article>
          ))}
        </div>
        <div className="pd-analytics-charts">
          <section className="pd-report-card">
            <h2>
              销售额分布 <small>按筛选后的明细计算</small>
            </h2>
            <TrendChart
              values={filtered.map((r) => r.orders * r.price)}
              label="当前明细销售额分布"
              axisLabels={filtered.map((r) => r.id.replace("SL-", ""))}
            />
          </section>
          <section className="pd-report-card">
            <h2>渠道贡献</h2>
            {totals.map(({ name, value }, i) => (
              <div className="pd-channel-bar" key={name}>
                <div>
                  <span>{name}</span>
                  <strong>
                    {revenue ? ((value / revenue) * 100).toFixed(1) : 0}%
                  </strong>
                </div>
                <span>
                  <i
                    style={{
                      width: `${revenue ? (value / revenue) * 100 : 0}%`,
                      background: ["#648c7c", "#9cafc3", "#cfb98e"][i],
                    }}
                  />
                </span>
                <small>{money(value)}</small>
              </div>
            ))}
          </section>
        </div>
        <section className="pd-report-card pd-data-detail">
          <div className="pd-section-title">
            <div>
              <h2>销售明细</h2>
              <button
                disabled={rows.length >= 1000}
                onClick={() => {
                  setRows((v) => [
                    {
                      id: `SL-${Date.now()}`,
                      month: month === "all" ? "10" : month,
                      channel: channel === "all" ? "官网" : channel,
                      region: "华东",
                      orders: 0,
                      price: 0,
                      returns: 0,
                    },
                    ...v,
                  ]);
                  setPage(0);
                  setSort("id");
                  setImportMessage("已新增空白记录，可在当前数据集中编辑。");
                }}
              >
                ＋ 新增记录
              </button>
              <small>
                {filtered.length} 条记录 · 订单数可直接编辑，指标与图表同步更新
              </small>
            </div>
            <Select
              label="排序"
              value={sort}
              onChange={(v) => {
                setSort(v);
                setPage(0);
              }}
              options={[
                ["id", "编号顺序"],
                ["revenue", "销售额降序"],
              ]}
            />
          </div>
          <div className="pd-table-scroll">
            <table aria-label="销售明细">
              <thead>
                <tr>
                  <th>记录编号</th>
                  <th>月份</th>
                  <th>渠道 / 区域</th>
                  <th>订单数</th>
                  <th>均价</th>
                  <th>销售额</th>
                  <th>退款单</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(page * 6, page * 6 + 6).map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.id}</code>
                    </td>
                    <td>
                      <select
                        aria-label={`${r.id}月份`}
                        value={r.month}
                        onChange={(e) =>
                          setRows((v) =>
                            v.map((t) =>
                              t.id === r.id
                                ? { ...t, month: e.target.value }
                                : t,
                            ),
                          )
                        }
                      >
                        {Array.from({ length: 12 }, (_, i) =>
                          String(i + 1).padStart(2, "0"),
                        ).map((m) => (
                          <option key={m} value={m}>
                            {Number(m)} 月
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`${r.id}渠道`}
                        value={r.channel}
                        onChange={(e) =>
                          setRows((v) =>
                            v.map((t) =>
                              t.id === r.id
                                ? { ...t, channel: e.target.value }
                                : t,
                            ),
                          )
                        }
                      >
                        {["官网", "品牌门店", "渠道合作"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        aria-label={`${r.id}区域`}
                        value={r.region}
                        maxLength={40}
                        onChange={(e) =>
                          setRows((v) =>
                            v.map((t) =>
                              t.id === r.id
                                ? { ...t, region: e.target.value }
                                : t,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${r.id}订单数`}
                        type="number"
                        min={0}
                        max={9999}
                        value={r.orders}
                        onChange={(e) =>
                          setRows((v) =>
                            v.map((item) =>
                              item.id === r.id
                                ? {
                                    ...item,
                                    orders: Math.floor(
                                      numberInput(e.target.value, 9999),
                                    ),
                                    returns: Math.min(
                                      item.returns,
                                      Math.floor(
                                        numberInput(e.target.value, 9999),
                                      ),
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${r.id}均价`}
                        type="number"
                        min="0"
                        max="10000000"
                        value={r.price}
                        onChange={(e) =>
                          setRows((v) =>
                            v.map((t) =>
                              t.id === r.id
                                ? {
                                    ...t,
                                    price: numberInput(
                                      e.target.value,
                                      10000000,
                                    ),
                                  }
                                : t,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <strong>{money(r.orders * r.price)}</strong>
                    </td>
                    <td>
                      <input
                        aria-label={`${r.id}退款单`}
                        type="number"
                        min="0"
                        max={r.orders}
                        value={r.returns}
                        onChange={(e) =>
                          setRows((v) =>
                            v.map((t) =>
                              t.id === r.id
                                ? {
                                    ...t,
                                    returns: Math.floor(
                                      numberInput(e.target.value, r.orders),
                                    ),
                                  }
                                : t,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pd-pagination">
            <small>模拟经营数据 · 所有计算均在本地完成</small>
            <div>
              <button
                disabled={page === 0}
                onClick={() => setPage((v) => v - 1)}
              >
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
      </div>
    </div>
  );
}

export { Slides } from "./Slides";

export { Email } from "./Email";
