import { useEffect, useState, type ReactNode } from "react";
import { SampleTop, Notice, copySample } from "../shared";
import { useDraftTools } from "../DraftTools";
import {
  pages,
  resources,
  events,
  initial,
  restore,
  bookingError,
  estimate,
  time,
  money,
  cost,
  validDate,
  type State,
} from "./model";
import { images } from "./images";
import {
  seating,
  jsonExport,
  csvExport,
  calendar,
  svgExport,
  htmlExport,
} from "./delivery";
import "./daylight.css";
export default function DaylightPrototype({ draftId }: { draftId?: string }) {
  const {
      state: s,
      patch,
      go,
      error,
      notice,
      msg,
      controls,
    } = useDraftTools("daylight", draftId, initial, restore),
    [busy, setBusy] = useState(false),
    [now, tick] = useState(Date.now()),
    q = estimate(s);
  useEffect(() => {
    if (!s.focusEnd) return;
    const timer = setInterval(() => tick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [s.focusEnd]);
  const change = (p: Partial<State>) => patch(restore({ ...s, ...p }));
  const text = (
    label: string,
    key:
      | "project"
      | "brief"
      | "bookingTitle"
      | "memberName"
      | "ticketText"
      | "visitor"
      | "feedback",
    multi = false,
  ) => (
    <label className="dl-field">
      {label}
      {multi ? (
        <textarea
          value={s[key]}
          maxLength={2000}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
      ) : (
        <input
          value={s[key]}
          maxLength={80}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
      )}
    </label>
  );
  const num = (
    label: string,
    key: keyof State,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="dl-field">
      {label}
      <input
        type="number"
        aria-label={label}
        value={s[key] as number}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n))
            change({ [key]: Math.max(min, Math.min(max, n)) });
        }}
      />
    </label>
  );
  const select = (
    label: string,
    value: number,
    options: readonly string[],
    fn: (n: number) => void,
  ) => (
    <label className="dl-field">
      {label}
      <select value={value} onChange={(e) => fn(+e.target.value)}>
        {options.map((v, i) => (
          <option key={v} value={i}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
  const date = (label: string, key: "date" | "calendarDate" | "visitDate") => (
    <label className="dl-field">
      {label}
      <input
        type="date"
        value={s[key]}
        onChange={(e) => {
          if (validDate(e.target.value)) change({ [key]: e.target.value });
        }}
      />
    </label>
  );
  const check = (
    labels: string[],
    values: boolean[],
    fn: (v: boolean[]) => void,
  ) => (
    <div className="dl-checks">
      {labels.map((v, i) => (
        <label key={v}>
          <input
            type="checkbox"
            checked={values[i]}
            onChange={(e) =>
              fn(values.map((x, j) => (j === i ? e.target.checked : x)))
            }
          />
          {v}
        </label>
      ))}
    </div>
  );
  const img = (name: keyof typeof images, alt: string) => (
    <img
      className="dl-photo"
      loading="lazy"
      src={images[name]}
      alt={alt + "（AI 概念图）"}
    />
  );
  const badge = (label: string, value: string, note: string) => (
    <article className="dl-stat">
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
  const book = (resource: number) => {
    const b = {
        resource,
        date: s.date,
        start: s.start,
        duration: s.duration,
        people: s.people,
        title: s.bookingTitle,
      },
      invalid = bookingError(s, b);
    return (
      <div className="dl-booking-form">
        {text("预约主题", "bookingTitle")}
        {date("东京预约日期", "date")}
        <div className="dl-two">
          <label className="dl-field">
            开始时间
            <input
              type="time"
              step={1800}
              value={time(s.start)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                if (Number.isFinite(h + m)) change({ start: h * 60 + m });
              }}
            />
          </label>
          {select(
            "预约时长",
            s.duration / 30 - 1,
            Array.from({ length: 8 }, (_, i) => (i + 1) * 30 + " 分钟"),
            (v) => change({ duration: (v + 1) * 30 }),
          )}
        </div>
        {num("参与人数", "people", 1, resources[resource].capacity)}
        <p className="dl-disclosure">
          {invalid || "当前本地台账未发现容量或时段冲突。"}
        </p>
        <div className="dl-booking-price">
          <strong>{money(cost(b))}</strong>
          <small>示例空间费用 / 非付款</small>
        </div>
        <button
          className="dl-primary"
          disabled={!!invalid}
          onClick={() => {
            const failure = bookingError(s, b);
            if (failure) {
              msg(failure);
              return;
            }
            change({
              bookings: [
                ...s.bookings,
                {
                  ...b,
                  id: crypto.randomUUID(),
                  checked: false,
                  cancelled: false,
                },
              ],
            });
            msg("本地预约已保存；没有真实预订、付款或通知。");
          }}
        >
          保存本地预约
        </button>
      </div>
    );
  };
  const bookingList = (list = s.bookings) => (
    <div className="dl-booking-list">
      {list.length ? (
        list.map((b) => (
          <article key={b.id}>
            <div>
              <small>
                {b.date} · {time(b.start)}–{time(b.start + b.duration)} JST
              </small>
              <h3>{b.title}</h3>
              <p>
                {resources[b.resource].name} / {b.people}人 · {money(cost(b))}
              </p>
            </div>
            <div>
              <b>
                {b.cancelled
                  ? "本地已取消"
                  : b.checked
                    ? "本地已签到"
                    : "本地有效"}
              </b>
              <button
                disabled={b.cancelled}
                aria-label={"取消预约 " + b.title}
                onClick={() => {
                  if (confirm("取消这条本地预约？没有退款或场地通知。"))
                    change({
                      bookings: s.bookings.map((x) =>
                        x.id === b.id ? { ...x, cancelled: true } : x,
                      ),
                    });
                }}
              >
                取消预约
              </button>
            </div>
          </article>
        ))
      ) : (
        <div className="dl-empty">
          <h3>还没有安排。</h3>
          <p>
            先选择工位、会议室或录音室，保存时段后将出现在这里。台账不会预装其他用户的假预约。
          </p>
          <button onClick={() => go(3)}>浏览空间</button>
        </div>
      )}
    </div>
  );
  const invoiceTable = (
    <div className="dl-table">
      <table>
        <thead>
          <tr>
            <th>项目</th>
            <th>示例金额</th>
          </tr>
        </thead>
        <tbody>
          {q.rows.map((r, i) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td>{money(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>税费 {money(q.tax)}</p>
      <strong className="dl-total" data-testid="daylight-total">
        {money(q.total)}
      </strong>
    </div>
  );
  const execute = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
      msg("文件已生成，没有发送、预订或扣款。");
    } catch {
      msg("导出失败，请检查素材后重试。");
    } finally {
      setBusy(false);
    }
  };
  let body: ReactNode;
  switch (s.page) {
    case 0:
      body = (
        <>
          <div className="dl-hero">
            <div>
              <small>SPACE FOR A BETTER WORKDAY</small>
              <h1>
                Make room
                <br />
                for <em>good work.</em>
              </h1>
              <p>
                从一个安静的上午，
                <br />
                到一次值得期待的协作。
              </p>
              <button className="dl-primary" onClick={() => go(3)}>
                找到今天的空间 ↗
              </button>
            </div>
            {img("lounge", "明亮的共享休憩区")}
          </div>
          <div className="dl-ribbon">
            <span>WORK / MEET / CREATE</span>
            <span>08:00–20:00 · TOKYO TIME</span>
          </div>
          <div className="dl-three">
            {badge("01 / FOCUS", "专注", "12 人工位区，按同时段容量检查。")}
            {badge("02 / CONNECT", "协作", "6 人会议室，独占时段不重叠。")}
            {badge("03 / CREATE", "表达", "2 人录音室，记录创作需求。")}
          </div>
          <p>{pages[0][2]}</p>
        </>
      );
      break;
    case 1:
      body = (
        <div className="dl-two">
          <div>
            {text("项目名称", "project")}
            {text("工作目标", "brief", true)}
            {num("计划团队人数", "teamSize", 1, 12)}
            {select(
              "今日工作偏好",
              s.mode,
              ["独立专注", "小组协作", "内容创作"],
              (mode) => change({ mode }),
            )}
          </div>
          <aside className="dl-note">
            <small>YOUR WORKING RHYTHM</small>
            <h3>
              {
                [
                  "把干扰留在门外。",
                  "让讨论有共同的节奏。",
                  "为表达保留准备时间。",
                ][s.mode]
              }
            </h3>
            <p>
              {
                [
                  "建议先规划一段安静工作，再为电话与讨论留出独立时段。",
                  "明确主持人、参与人数与讨论目标；预留收尾和整理时间。",
                  "录制前核对设备需求、素材授权与备份方式，避免把预约当成内容生产。",
                ][s.mode]
              }
            </p>
            <button onClick={() => go([4, 5, 6][s.mode])}>
              进入匹配的空间 →
            </button>
          </aside>
        </div>
      );
      break;
    case 2:
      body = (
        <div className="dl-two">
          <div className="dl-map">
            <div>FOCUS ZONE</div>
            <div>MEETING</div>
            <div>LOUNGE / ENTRY</div>
            <div>STUDIO</div>
            <small>概念楼层示意 / 非实际导航或疏散图</small>
          </div>
          <div>
            <h3>到访之前的四件事</h3>
            <ol>
              <li>核对真实场地地址与开放时间。</li>
              <li>确认无障碍需求、访客规则与联系人。</li>
              <li>准备自己的预约确认，而非使用本样板编号。</li>
              <li>设备、电源和网络要求提前向运营方确认。</li>
            </ol>
            <p className="dl-disclosure">
              本样板全部日程使用 Asia/Tokyo；导出 ICS 内嵌 JST
              时区，不读取用户定位。
            </p>
          </div>
        </div>
      );
      break;
    case 3:
      body = (
        <div className="dl-resource-grid">
          {resources.map((r, i) => (
            <article key={r.name}>
              {img((["focus", "meeting", "studio"] as const)[i], r.name)}
              <div>
                <small>SPACE / 0{i + 1}</small>
                <h3>{r.name}</h3>
                <p>{r.detail}</p>
                <b>
                  {r.capacity} 人上限 · {money(r.rate)} / {r.unit}
                </b>
                <button
                  onClick={() => {
                    patch({
                      people: Math.min(s.people, r.capacity),
                      page: 4 + i,
                    });
                  }}
                >
                  安排{r.name} →
                </button>
              </div>
            </article>
          ))}
        </div>
      );
      break;
    case 4:
    case 5:
    case 6: {
      const r = s.page - 4;
      body = (
        <div className="dl-two">
          <div>
            {img(
              (["focus", "meeting", "studio"] as const)[r],
              resources[r].name,
            )}
            <h3>{resources[r].name}</h3>
            <p>{resources[r].detail}</p>
            {r === 0 ? (
              <div className="dl-availability">
                {Array.from({ length: 12 }, (_, i) => {
                  const t = 480 + i * 60,
                    used = s.bookings
                      .filter(
                        (b) =>
                          !b.cancelled &&
                          b.resource === 0 &&
                          b.date === s.date &&
                          b.start <= t &&
                          b.start + b.duration > t,
                      )
                      .reduce((a, b) => a + b.people, 0);
                  return (
                    <span key={t}>
                      {time(t)}
                      <b>{12 - used} / 12</b>
                      <small>整点可用人数</small>
                    </span>
                  );
                })}
              </div>
            ) : r === 2 ? (
              check(
                ["双麦克风", "耳机监听", "屏幕演示"],
                s.equipment,
                (equipment) => change({ equipment }),
              )
            ) : (
              <ul>
                <li>屏幕与白板为需求示例，非实际设备确认。</li>
                <li>建议为整理场地预留时间。</li>
                <li>会议室按独占时段检查。</li>
              </ul>
            )}
          </div>
          {book(r)}
        </div>
      );
      break;
    }
    case 7:
      body = (
        <>
          <div className="dl-three">
            {["人时通行", "人日通行", "人月通行"].map((v, i) => (
              <article
                className={"dl-pass " + (s.pass === i ? "selected" : "")}
                key={v}
              >
                <small>ACCESS / 0{i + 1}</small>
                <h3>{v}</h3>
                <strong>{money([35, 180, 2400][i])}</strong>
                <p>
                  {
                    [
                      "每人每小时，适合短时使用。",
                      "每人每天，示例开放时间内使用。",
                      "每人每月，仅演算，不自动续费。",
                    ][i]
                  }
                </p>
                <button
                  aria-pressed={s.pass === i}
                  onClick={() => change({ pass: i })}
                >
                  选择{v}
                </button>
              </article>
            ))}
          </div>
          <div className="dl-three">
            {num("计划团队人数", "teamSize", 1, 12)}
            {s.pass < 2 ? (
              num(s.pass === 0 ? "计划小时数" : "计划天数", "days", 1, 31)
            ) : (
              <p>月度口径按一个月计算，与小时/天数输入无关。</p>
            )}
            {badge(
              "PASS ESTIMATE",
              money(q.passCost),
              "独立通行预算，费用页可选择此口径。",
            )}
          </div>
        </>
      );
      break;
    case 8:
      body = (
        <div className="dl-two">
          <div>
            {text("新增成员称呼", "memberName")}
            {select(
              "规划角色",
              s.memberRole,
              ["发起人", "协作者", "访客"],
              (memberRole) => change({ memberRole }),
            )}
            <button
              disabled={s.members.length >= 12}
              onClick={() => {
                if (!s.memberName.trim()) {
                  msg("请填写成员称呼。");
                  return;
                }
                if (s.members.some((m) => m.name === s.memberName.trim())) {
                  msg("已有同名成员，请使用可区分的称呼。");
                  return;
                }
                change({
                  members: [
                    ...s.members,
                    {
                      id: crypto.randomUUID(),
                      name: s.memberName.trim(),
                      role: s.memberRole,
                    },
                  ],
                  memberName: "",
                });
                msg("成员已加入本地规划名册；没有发送邀请。");
              }}
            >
              加入规划名册
            </button>
            <p>
              最多十二人；移除成员会同时释放其座位并移除关联访客计划，需先确认。
            </p>
          </div>
          <div className="dl-members">
            {s.members.map((m) => (
              <article key={m.id}>
                <span>{m.name.slice(0, 1)}</span>
                <div>
                  <h3>{m.name}</h3>
                  <p>{["发起人", "协作者", "访客"][m.role]} / 规划角色</p>
                </div>
                <button
                  aria-label={"移除成员 " + m.name}
                  onClick={() => {
                    if (confirm("移除成员及其座位、访客关联？"))
                      change({
                        members: s.members.filter((x) => x.id !== m.id),
                      });
                  }}
                >
                  移除
                </button>
              </article>
            ))}
          </div>
        </div>
      );
      break;
    case 9:
      body = (
        <>
          <label className="dl-field">
            分配给成员
            <select
              value={s.selectedMember}
              onChange={(e) => change({ selectedMember: e.target.value })}
            >
              <option value="" disabled>
                先添加成员
              </option>
              {s.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="dl-seats">
            {s.seats.map((id, i) => (
              <button
                key={i}
                className={id ? "occupied" : ""}
                aria-label={
                  "座位 " +
                  (i + 1) +
                  " " +
                  (s.members.find((m) => m.id === id)?.name || "空位")
                }
                onClick={() => {
                  if (!s.selectedMember) {
                    msg("请先添加并选择成员。");
                    return;
                  }
                  if (id && id !== s.selectedMember) {
                    msg("这个座位已有成员，请先释放或选择其他座位。");
                    return;
                  }
                  change({
                    seats: s.seats.map((x, n) =>
                      n === i
                        ? x === s.selectedMember
                          ? null
                          : s.selectedMember
                        : x === s.selectedMember
                          ? null
                          : x,
                    ),
                  });
                }}
              >
                <small>DESK {String(i + 1).padStart(2, "0")}</small>
                <b>{s.members.find((m) => m.id === id)?.name || "未分配"}</b>
                <span>{id ? "点击本人座位可释放" : "点击分配"}</span>
              </button>
            ))}
          </div>
          <p>
            同一成员重新分配会释放旧座位；不能直接抢占其他成员的座位。这不是门禁权限或时段预订。
          </p>
        </>
      );
      break;
    case 10:
      body = (
        <>
          <div className="dl-three">
            {badge(
              "ACTIVE",
              s.bookings.filter((b) => !b.cancelled).length + " 条",
              "当前本地有效预约",
            )}
            {badge(
              "CHECKED IN",
              s.bookings.filter((b) => !b.cancelled && b.checked).length +
                " 条",
              "手动签到，不是传感器数据",
            )}
            {badge(
              "CANCELLED",
              s.bookings.filter((b) => b.cancelled).length + " 条",
              "本地取消，没有退款动作",
            )}
          </div>
          {bookingList()}
        </>
      );
      break;
    case 11:
      body = (
        <>
          <div className="dl-three">
            {select(
              "费用计费口径",
              s.billing,
              ["按有效预约", "按独立通行预算"],
              (billing) => change({ billing }),
            )}
            {num("示例税率（%）", "tax", 0, 20)}
            {num("项目预算（元）", "budget", 0, 100000, 100)}
          </div>
          {invoiceTable}
          <p className="dl-disclosure">
            预算差额 {money(s.budget - q.total)}。
            {s.billing
              ? "当前不叠加预约费用，通行预算仅作独立情景估算。"
              : "已取消预约不计费；未叠加通行预算。"}
          </p>
        </>
      );
      break;
    case 12:
      body = (
        <div className="dl-checkin">
          {s.bookings
            .filter((b) => !b.cancelled)
            .map((b) => (
              <article key={b.id}>
                <small>LOCAL ARRIVAL RECORD</small>
                <h3>{b.title}</h3>
                <p>
                  {b.date} / {time(b.start)} / {resources[b.resource].name}
                </p>
                <code>{b.id.slice(0, 8).toUpperCase()}</code>
                <button
                  disabled={b.checked}
                  onClick={() => {
                    change({
                      bookings: s.bookings.map((x) =>
                        x.id === b.id ? { ...x, checked: true } : x,
                      ),
                    });
                    msg("已记录本地签到；没有门禁或身份核验。");
                  }}
                >
                  {b.checked ? "本地已签到" : "记录本地签到"}
                </button>
              </article>
            ))}
          {!s.bookings.some((b) => !b.cancelled) && (
            <div className="dl-empty">
              <h3>先安排一次到访。</h3>
              <p>只有有效本地预约才能记录签到。取消的预约不会在此处出现。</p>
              <button onClick={() => go(4)}>安排工位</button>
            </div>
          )}
        </div>
      );
      break;
    case 13:
      body = (
        <div className="dl-two">
          {img("community", "社区咖啡与配套区")}
          <div>
            {num("咖啡需求（杯）", "coffee", 0, 50)}
            {num("黑白打印（页）", "prints", 0, 1000)}
            {num("储物柜使用（日）", "lockers", 0, 30)}
            <h3>{money(s.coffee * 22 + s.prints * 0.5 + s.lockers * 15)}</h3>
            <p>
              咖啡 ¥22/杯，打印 ¥0.5/页，储物柜
              ¥15/日。没有食品订单、打印任务或储物柜开锁动作。
            </p>
          </div>
        </div>
      );
      break;
    case 14:
      body = (
        <>
          <div className="dl-three">
            {events.map((e, i) => (
              <article className="dl-event" key={e.name}>
                <small>
                  {e.date} / {e.time} JST
                </small>
                <h3>{e.name}</h3>
                <p>{e.detail}</p>
                <b>本地人数上限 {e.cap}</b>
                <p>
                  {s.joins[i]
                    ? "当前方案意向 " + s.joins[i] + " 人"
                    : "尚未记录意向"}
                </p>
                <button
                  onClick={() => change({ event: i })}
                  aria-pressed={s.event === i}
                >
                  选择这个活动
                </button>
              </article>
            ))}
          </div>
          <div className="dl-two">
            <div>
              {num("活动意向人数", "attendees", 1, 16)}
              <button
                disabled={s.attendees > events[s.event].cap}
                onClick={() => {
                  change({
                    joins: s.joins.map((n, i) =>
                      i === s.event ? s.attendees : n,
                    ),
                  });
                  msg("活动意向已保存在本地，没有真实报名或通知。");
                }}
              >
                保存活动意向
              </button>
              <button
                disabled={!s.joins[s.event]}
                onClick={() =>
                  change({
                    joins: s.joins.map((n, i) => (i === s.event ? 0 : n)),
                  })
                }
              >
                取消当前意向
              </button>
              {s.attendees > events[s.event].cap && (
                <p>人数超过当前示例活动上限。</p>
              )}
            </div>
            {img("community", "社区交流区")}
          </div>
        </>
      );
      break;
    case 15:
      body = (
        <>
          {date("查看东京日期", "calendarDate")}
          <div className="dl-agenda">
            {Array.from({ length: 12 }, (_, i) => 480 + i * 60).map((t) => (
              <div key={t}>
                <time>{time(t)}</time>
                <section>
                  {s.bookings
                    .filter(
                      (b) =>
                        !b.cancelled &&
                        b.date === s.calendarDate &&
                        b.start < t + 60 &&
                        b.start + b.duration > t,
                    )
                    .map((b) => (
                      <article key={b.id}>
                        <b>{b.title}</b>
                        <span>
                          {time(b.start)}–{time(b.start + b.duration)} ·{" "}
                          {resources[b.resource].name}
                        </span>
                      </article>
                    ))}
                </section>
              </div>
            ))}
          </div>
          <button onClick={() => calendar(s)}>导出东京时区 ICS</button>
          <p>
            ICS
            包含全部有效本地预约。取消后重新导出不会删除外部日历中已导入的事件，需要自行处理。
          </p>
        </>
      );
      break;
    case 16: {
      const remaining = Math.max(0, Math.ceil((s.focusEnd - now) / 1000));
      body = (
        <div className="dl-two">
          <div className="dl-timer">
            <small>ONE THING AT A TIME</small>
            <strong>
              {s.focusEnd
                ? `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`
                : `${s.focusMinutes}:00`}
            </strong>
            <p>
              {s.focusEnd
                ? remaining
                  ? "专注进行中 · 使用真实时间戳"
                  : "已到时间，休息一下。"
                : "准备开始一段不被打扰的时间。"}
            </p>
            <button
              onClick={() => {
                tick(Date.now());
                change({ focusEnd: Date.now() + s.focusMinutes * 60000 });
              }}
            >
              开始专注
            </button>
            <button
              disabled={!s.focusEnd}
              onClick={() => change({ focusEnd: 0 })}
            >
              停止计时
            </button>
          </div>
          <div>
            {num("专注时长（分钟）", "focusMinutes", 1, 120)}
            <h3>共享空间的安静规则</h3>
            <ul>
              <li>电话与小组讨论移步讨论区。</li>
              <li>使用耳机，避免外放音频。</li>
              <li>离开前整理桌面，不占用他人物品。</li>
              <li>关闭页面不保证系统通知，计时不是后台任务服务。</li>
            </ul>
          </div>
        </div>
      );
      break;
    }
    case 17:
      body = (
        <div className="dl-two">
          <div>
            {select(
              "问题类型",
              s.ticketType,
              ["设备", "环境", "清洁"],
              (ticketType) => change({ ticketType }),
            )}
            {text("问题描述", "ticketText", true)}
            <button
              disabled={s.tickets.length >= 10}
              onClick={() => {
                if (s.ticketText.trim().length < 8) {
                  msg("请至少填写 8 个字符描述问题。");
                  return;
                }
                change({
                  tickets: [
                    {
                      id: crypto.randomUUID(),
                      type: s.ticketType,
                      text: s.ticketText,
                      done: false,
                    },
                    ...s.tickets,
                  ].slice(0, 10),
                  ticketText: "",
                });
                msg("本地工单草稿已保存，未发送给运营人员。");
              }}
            >
              保存本地工单
            </button>
          </div>
          <aside>
            {s.tickets.map((t) => (
              <article className="dl-note" key={t.id}>
                <small>
                  {["设备", "环境", "清洁"][t.type]} /{" "}
                  {t.done ? "手动完成" : "未发送草稿"}
                </small>
                <p>{t.text}</p>
                <button
                  onClick={() =>
                    change({
                      tickets: s.tickets.map((x) =>
                        x.id === t.id ? { ...x, done: !x.done } : x,
                      ),
                    })
                  }
                >
                  {t.done ? "重新打开" : "手动标记完成"}
                </button>
              </article>
            ))}
            {!s.tickets.length && (
              <p>
                尚无个人工单。紧急问题请直接联系实际场地方，本样板不会通知任何人。
              </p>
            )}
          </aside>
        </div>
      );
      break;
    case 18:
      body = (
        <div className="dl-two">
          <div>
            {text("访客称呼", "visitor")}
            {date("访客东京日期", "visitDate")}
            <label className="dl-field">
              接待成员
              <select
                value={s.host}
                onChange={(e) => change({ host: e.target.value })}
              >
                <option value="" disabled>
                  先添加成员
                </option>
                {s.members.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={s.visitors.length >= 12}
              onClick={() => {
                if (
                  !s.visitor.trim() ||
                  !s.members.some((m) => m.id === s.host)
                ) {
                  msg("需要访客称呼与有效接待成员。");
                  return;
                }
                change({
                  visitors: [
                    ...s.visitors,
                    { name: s.visitor.trim(), date: s.visitDate, host: s.host },
                  ],
                  visitor: "",
                });
                msg("访客计划已保存，没有发送邀请或录入门禁。");
              }}
            >
              保存访客计划
            </button>
          </div>
          <div>
            {s.visitors.map((v, i) => (
              <article className="dl-note" key={i}>
                <h3>{v.name}</h3>
                <p>
                  {v.date} / 接待：
                  {s.members.find((m) => m.id === v.host)?.name}
                </p>
                <button
                  onClick={() =>
                    change({ visitors: s.visitors.filter((_, n) => n !== i) })
                  }
                >
                  移除访客计划
                </button>
              </article>
            ))}
          </div>
        </div>
      );
      break;
    case 19:
      body = (
        <div className="dl-two">
          <div className="dl-safety">
            <span>01 / BEFORE YOU BEGIN</span>
            <h3>
              共同的空间，
              <br />
              共同的责任。
            </h3>
            <p>任何示意图和勾选状态都不能替代实际消防、电气与运营规则。</p>
          </div>
          <div>
            {check(
              [
                "通道保持畅通",
                "确认电源使用规则",
                "检查设备使用说明",
                "记录真实应急联系方式",
              ],
              s.safety,
              (safety) => change({ safety }),
            )}
            <p>
              已手动复核 {s.safety.filter(Boolean).length}/4 项，不是安全认证。
            </p>
            <button
              onClick={() => change({ safety: [false, false, false, false] })}
            >
              重新开始复核
            </button>
          </div>
        </div>
      );
      break;
    case 20:
      body = (
        <>
          <div className="dl-three">
            {num("设备数量", "devices", 0, 30)}
            {num("单设备功率（W）", "watts", 0, 500)}
            {num("使用时间（h）", "hours", 0, 24, 0.5)}
            {num("照明负荷（W）", "lighting", 0, 3000)}
            {num("电价情景（元/kWh）", "tariff", 0, 20, 0.1)}
          </div>
          <div className="dl-three">
            {badge(
              "ESTIMATED ENERGY",
              q.energy + " kWh",
              "(设备数量 × 功率 + 照明) × 小时 ÷ 1000",
            )}
            {badge(
              "ESTIMATED COST",
              money(q.energy * s.tariff),
              "此项不自动加入服务账单。",
            )}
            {badge(
              "NOT TELEMETRY",
              "情景估算",
              "未连接真实电表，未包含空调等负荷。",
            )}
          </div>
        </>
      );
      break;
    case 21:
      body = (
        <div className="dl-two">
          <div>
            {select(
              "个人体验评分",
              s.rating - 1,
              ["1 分", "2 分", "3 分", "4 分", "5 分"],
              (rating) => change({ rating: rating + 1 }),
            )}
            {text("体验说明", "feedback", true)}
            <button
              disabled={s.reviews.length >= 10}
              onClick={() => {
                if (s.feedback.trim().length < 8) {
                  msg("请至少填写 8 个字符说明体验。");
                  return;
                }
                change({
                  reviews: [
                    {
                      at: new Date().toISOString(),
                      rating: s.rating,
                      text: s.feedback,
                    },
                    ...s.reviews,
                  ].slice(0, 10),
                  feedback: "",
                });
                msg("个人体验已保存，没有发布公共评价。");
              }}
            >
              保存个人体验
            </button>
          </div>
          <aside>
            <h3>
              {s.reviews.length
                ? (
                    s.reviews.reduce((a, b) => a + b.rating, 0) /
                    s.reviews.length
                  ).toFixed(1) + " / 5"
                : "尚无评分"}
            </h3>
            <p>仅此方案内 {s.reviews.length} 条个人记录，不是客户口碑。</p>
            {s.reviews.map((r, i) => (
              <article className="dl-note" key={i}>
                <small>
                  {r.rating} / 5 · {r.at.slice(0, 10)}
                </small>
                <p>{r.text}</p>
              </article>
            ))}
          </aside>
        </div>
      );
      break;
    case 22:
      body = (
        <div className="dl-two">
          <div>
            <h3>当前演算 {money(q.total)}</h3>
            <p>
              计费口径：{s.billing ? "独立通行预算" : "有效预约"}
              。先复核费用与服务条目，再冻结确认稿。
            </p>
            <button
              onClick={() => {
                if (s.invoice && !confirm("替换已有费用快照？")) return;
                change({
                  invoice: {
                    at: new Date().toISOString(),
                    project: s.project,
                    mode: s.billing ? "独立通行预算" : "有效预约",
                    rows: q.rows.map((r) => ({ ...r })),
                    tax: q.tax,
                    total: q.total,
                  },
                });
                msg("本地费用快照已冻结，不是订单或付款凭证。");
              }}
            >
              冻结费用快照
            </button>
            {s.invoice && (
              <button
                onClick={() => {
                  if (confirm("删除本地费用快照？")) change({ invoice: null });
                }}
              >
                删除费用快照
              </button>
            )}
          </div>
          <article className="dl-invoice">
            {s.invoice ? (
              <>
                <small>ESTIMATE / NOT AN INVOICE</small>
                <h3>{s.invoice.project}</h3>
                <p>
                  {s.invoice.at.slice(0, 10)} / {s.invoice.mode}
                </p>
                {s.invoice.rows.map((r, i) => (
                  <div key={i}>
                    <span>{r.name}</span>
                    <b>{money(r.amount)}</b>
                  </div>
                ))}
                <div>
                  <span>冻结税费</span>
                  <b>{money(s.invoice.tax)}</b>
                </div>
                <strong>{money(s.invoice.total)}</strong>
                <p>冻结后不随当前配置自动变化。未预订、未付款、未开票。</p>
              </>
            ) : (
              <>
                <h3>还没有冻结快照。</h3>
                <p>当前费用只是一份可编辑估算，尚未形成讨论版本。</p>
              </>
            )}
          </article>
        </div>
      );
      break;
    default:
      body = (
        <>
          <div className="dl-delivery">
            <small>TAKE YOUR PLAN WITH YOU</small>
            <h3>从意向，到一份可交接的安排。</h3>
            <div>
              {[
                ["项目 JSON", () => jsonExport(s)],
                ["预约 CSV", () => csvExport(s)],
                ["日历 ICS", () => calendar(s)],
                ["座位 SVG", () => svgExport(s)],
                ["24 章离线 HTML", () => htmlExport(s)],
              ].map(([title, fn]) => (
                <button
                  key={String(title)}
                  disabled={busy}
                  onClick={() => void execute(fn as () => Promise<void> | void)}
                >
                  {busy ? "正在生成…" : String(title)}
                </button>
              ))}
            </div>
          </div>
          <label className="dl-field">
            导入 DAYLIGHT 项目
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  if (f.size > 500000) throw Error("文件不能超过500KB。");
                  const v = JSON.parse(await f.text());
                  if (
                    v.format !== "daylight-project-v1" ||
                    typeof v.state?.project !== "string"
                  )
                    throw Error("不是 DAYLIGHT 项目文件。");
                  if (confirm("替换当前草稿？")) patch(restore(v.state));
                } catch (e) {
                  msg(e instanceof Error ? e.message : "导入失败。");
                }
              }}
            />
          </label>
          <div
            className="dl-floor-preview"
            dangerouslySetInnerHTML={{ __html: seating(s) }}
          />
          <p>
            五张专用 AI 概念图与中文字体随 HTML
            内嵌。服务器保存为显式快照，命名版本只在本机。所有空间预约、活动和签到为演示规划，不会创建商家订单、日历授权或门禁权限。
          </p>
        </>
      );
  }
  return (
    <main className="daylight-work">
      <SampleTop
        type="原型 / 24 个办公场景页面"
        title="DAYLIGHT · 联合办公空间"
        draftId={draftId}
        onCopy={() => {
          try {
            copySample("daylight", s);
          } catch {
            msg("副本保存失败，请先导出。");
          }
        }}
      >
        <button onClick={() => go(23)}>交付安排</button>
      </SampleTop>
      <Notice text={error || notice} />
      {controls}
      <div className="dl-shell">
        <header className="dl-brand">
          <b>
            daylight<span>WORK, WITH A LITTLE MORE LIFE.</span>
          </b>
          <span>{s.project}</span>
          <button onClick={() => go(3)}>找一个空间 ↗</button>
        </header>
        <nav className="dl-nav" aria-label="DAYLIGHT 导航">
          <div>
            {["发现空间", "团队与方案", "到访与体验", "运营与交付"].map(
              (v, i) => (
                <button
                  key={v}
                  aria-current={
                    Math.floor(s.page / 6) === i ? "page" : undefined
                  }
                  onClick={() => go(i * 6)}
                >
                  {v}
                </button>
              ),
            )}
          </div>
          <select
            aria-label="DAYLIGHT 页面目录"
            value={s.page}
            onChange={(e) => go(+e.target.value)}
          >
            {pages.map((p, i) => (
              <option key={p[0]} value={i}>
                {String(i + 1).padStart(2, "0")} / {p[0]}
              </option>
            ))}
          </select>
        </nav>
        <section
          className={"dl-page dl-page-" + s.page}
          data-page={s.page}
          aria-label={pages[s.page][0]}
        >
          {s.page > 0 && (
            <header className="dl-heading">
              <small>
                {String(s.page + 1).padStart(2, "0")} / THE DAYLIGHT EXPERIENCE
              </small>
              <h1>{pages[s.page][1]}</h1>
              <p>{pages[s.page][2]}</p>
            </header>
          )}
          {body}
          <footer>
            <span>
              {String(s.page + 1).padStart(2, "0")} / 24 — LOCAL PLANNING ONLY
            </span>
            <div>
              <button disabled={!s.page} onClick={() => go(s.page - 1)}>
                ← 上一页
              </button>
              <button disabled={s.page === 23} onClick={() => go(s.page + 1)}>
                下一页 →
              </button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
