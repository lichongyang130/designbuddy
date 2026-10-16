import { useState, type ReactNode } from "react";
import { SampleTop, Notice, copySample } from "../shared";
import { useDraftTools } from "../DraftTools";
import {
  pages,
  boats,
  plans,
  courses,
  events,
  initial,
  restore,
  calculate,
  intentError,
  time,
  money,
  round,
  validDate,
  validMonth,
  type State,
  type Intent,
} from "./model";
import { images } from "./images";
import {
  routeSVG,
  jsonExport,
  csvExport,
  svgExport,
  contactsExport,
  htmlExport,
} from "./delivery";
import "./tide.css";
export default function TidePrototype({ draftId }: { draftId?: string }) {
  const {
      state: s,
      patch,
      go,
      error,
      notice,
      msg,
      controls,
    } = useDraftTools("tide", draftId, initial, restore),
    [busy, setBusy] = useState(false),
    c = calculate(s),
    boat = boats[s.boat];
  const change = (p: Partial<State>) => patch(restore({ ...s, ...p }));
  const text = (label: string, key: keyof State, multi = false) => (
    <label className="td-field">
      {label}
      {multi ? (
        <textarea
          value={s[key] as string}
          maxLength={2000}
          onChange={(e) => change({ [key]: e.target.value })}
        />
      ) : (
        <input
          value={s[key] as string}
          maxLength={120}
          onChange={(e) => change({ [key]: e.target.value })}
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
    <label className="td-field">
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
    <label className="td-field">
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
  const date = (label: string, key: "date" | "logDate") => (
    <label className="td-field">
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
  const month = (
    <label className="td-field">
      核算月份
      <input
        type="month"
        value={s.month}
        onChange={(e) => {
          if (validMonth(e.target.value)) change({ month: e.target.value });
        }}
      />
    </label>
  );
  const image = (key: keyof typeof images, alt: string) => (
    <img
      className="td-photo"
      loading="lazy"
      src={images[key]}
      alt={alt + "（AI 概念图）"}
    />
  );
  const stat = (label: string, value: string, note: string) => (
    <article className="td-stat">
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
  const route = (
    <div
      className="td-chart"
      dangerouslySetInnerHTML={{ __html: routeSVG(s) }}
    />
  );
  const moneyTable = (
    <div className="td-table">
      <table>
        <thead>
          <tr>
            <th>费用条目</th>
            <th>示例金额</th>
          </tr>
        </thead>
        <tbody>
          {c.rows.map((r, i) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td>{money(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="td-total">
        <span>税费 {money(c.tax)}</span>
        <strong data-testid="tide-total">{money(c.total)}</strong>
      </div>
    </div>
  );
  const execute = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
      msg("文件已生成，未发送、未付款、未预约。");
    } catch {
      msg("文件生成失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  let body: ReactNode;
  switch (s.page) {
    case 0:
      body = (
        <>
          <div className="td-hero">
            {image("harbor", "海边码头")}
            <div>
              <small>THE MEMBERS JOURNAL / VOL. 01</small>
              <h1>
                Between
                <br />
                <em>land & sea.</em>
              </h1>
              <p>
                让每一次相聚，
                <br />
                从一份清楚的计划开始。
              </p>
              <button onClick={() => go(1)}>打开你的航海手记 ↗</button>
            </div>
            <span>FICTIONAL CLUB / NOT A BOOKING SERVICE</span>
          </div>
          <div className="td-three">
            {stat("01 / BELONG", "相聚", "会员方案、岸上活动与同行名册。")}
            {stat("02 / PLAN", "安排", "本地时段意向与月度额度核算。")}
            {stat("03 / REFLECT", "记录", "学习笔记、手动日志与独立交付。")}
          </div>
          <p>{pages[0][2]}</p>
        </>
      );
      break;
    case 1:
      body = (
        <div className="td-two">
          <div>
            {text("项目名称", "project")}
            {text("本次计划简报", "brief", true)}
            {select(
              "参与方式",
              s.aim,
              ["岸上交流", "初次学习", "持续学习"],
              (aim) => change({ aim }),
            )}
          </div>
          <aside className="td-note">
            <small>START WITH A CONVERSATION</small>
            <h3>
              {
                ["把人连接起来。", "把问题带给教练。", "把经历变成记录。"][
                  s.aim
                ]
              }
            </h3>
            <p>
              {
                [
                  "先确认相聚主题、人数与可用时间，不把岸上活动与实际出航混为一谈。",
                  "写下希望了解的内容，由专业教练决定合适的学习安排与现场要求。",
                  "每次活动后记录事实、问题和下次目标，避免用时数替代实际能力。",
                ][s.aim]
              }
            </p>
            <button onClick={() => go([17, 11, 14][s.aim])}>
              进入相关页面 →
            </button>
          </aside>
        </div>
      );
      break;
    case 2:
      body = (
        <>
          <div className="td-three">
            {plans.map((p, i) => (
              <article
                className={"td-plan " + (s.plan === i ? "selected" : "")}
                key={p.name}
              >
                <small>MEMBERSHIP / 0{i + 1}</small>
                <h3>{p.name}</h3>
                <strong>
                  {money(p.fee)}
                  <small>/ 月</small>
                </strong>
                <p>
                  每月最多规划 {p.hours}{" "}
                  小时时间意向。船只与教练示例费用另计，不是免费船时。
                </p>
                <button
                  aria-pressed={s.plan === i}
                  onClick={() => change({ plan: i })}
                >
                  选择{p.name}
                </button>
              </article>
            ))}
          </div>
          <p className="td-warning">
            未开通会员或订阅。方案降低不会删除已有意向；若超额，新的意向将被阻止。
          </p>
        </>
      );
      break;
    case 3:
      body = (
        <div className="td-two">
          <div>
            {text("会员称呼", "name")}
            {text("联系意向（不发送）", "contact")}
            {text("个人学习目标", "goal", true)}
          </div>
          <aside className="td-member">
            <small>PERSONAL PLANNING CARD</small>
            <b>TIDE</b>
            <h3>{s.name || "尚未填写称呼"}</h3>
            <p>{plans[s.plan].name}</p>
            <span>LOCAL PROFILE / NOT A MEMBERSHIP PASS</span>
          </aside>
        </div>
      );
      break;
    case 4:
      body = (
        <div className="td-fleet">
          {boats.map((b, i) => (
            <article key={b.name}>
              {image(b.photo, b.type)}
              <div>
                <small>FLEET STUDY / 0{i + 1}</small>
                <h3>{b.name}</h3>
                <p>
                  {b.type} · {b.feet} ft · 最多 {b.capacity} 人
                </p>
                <b>{money(b.rate)} / 小时</b>
                <button
                  onClick={() =>
                    patch({
                      boat: i,
                      people: Math.min(s.people, b.capacity),
                      page: 5,
                    })
                  }
                >
                  查看船只档案 →
                </button>
              </div>
            </article>
          ))}
        </div>
      );
      break;
    case 5:
      body = (
        <div className="td-two">
          <div>
            {image(boat.photo, boat.type)}
            <p>概念图片不代表船况、制造商配置或实际可用库存。</p>
          </div>
          <div>
            {select(
              "所选船只",
              s.boat,
              boats.map((b) => b.name),
              (boat) =>
                change({
                  boat,
                  people: Math.min(s.people, boats[boat].capacity),
                }),
            )}
            <h3>{boat.type}</h3>
            <dl className="td-spec">
              <dt>示例尺度</dt>
              <dd>{boat.feet} ft</dd>
              <dt>人数上限</dt>
              <dd>{boat.capacity} 人</dd>
              <dt>船只费用</dt>
              <dd>{money(boat.rate)}/h</dd>
            </dl>
            {text("待确认的额外需求", "request", true)}
            <button onClick={() => go(6)}>安排时间意向 →</button>
          </div>
        </div>
      );
      break;
    case 6: {
      const b: Intent = {
          id: "",
          date: s.date,
          boat: s.boat,
          start: s.start,
          minutes: s.minutes,
          people: s.people,
          title: s.title,
          coach: s.coach,
          cancelled: false,
        },
        invalid = !s.name.trim()
          ? "先在会员档案填写称呼。"
          : !s.ack
            ? "请确认这只是本地意向，不是出航批准。"
            : intentError(s, b);
      body = (
        <div className="td-two">
          <div>
            {select(
              "意向船只",
              s.boat,
              boats.map((b) => b.name),
              (boat) =>
                change({
                  boat,
                  people: Math.min(s.people, boats[boat].capacity),
                }),
            )}
            {text("意向主题", "title")}
            {date("意向日期", "date")}
            <div className="td-two">
              <label className="td-field">
                开始时间
                <input
                  type="time"
                  value={time(s.start)}
                  step={1800}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    if (Number.isFinite(h + m)) change({ start: h * 60 + m });
                  }}
                />
              </label>
              {select(
                "时段长度",
                s.minutes / 30 - 1,
                Array.from({ length: 8 }, (_, i) => (i + 1) * 30 + "分钟"),
                (n) => change({ minutes: (n + 1) * 30 }),
              )}
            </div>
            {num("同行人数", "people", 1, boat.capacity)}
            <label className="td-check">
              <input
                type="checkbox"
                checked={s.coach}
                onChange={(e) => change({ coach: e.target.checked })}
              />
              记录教练需求（示例 ¥180/h）
            </label>
            <label className="td-check">
              <input
                type="checkbox"
                checked={s.ack}
                onChange={(e) => change({ ack: e.target.checked })}
              />
              我知道这只是本地意向，不是出航批准
            </label>
          </div>
          <aside className="td-booking">
            <small>LOCAL TIME REQUEST</small>
            <h3>{boat.name}</h3>
            <strong>
              {money(((boat.rate + (s.coach ? 180 : 0)) * s.minutes) / 60)}
            </strong>
            <p>此时段示例费用，未包含月费与税费。</p>
            <p className="td-warning">
              {invalid ||
                "本地排期与时数检查无冲突；不代表实际可预约或可出航。"}
            </p>
            <button
              disabled={!!invalid}
              onClick={() => {
                if (intentError(s, b) || !s.ack || !s.name.trim()) return;
                change({
                  intents: [...s.intents, { ...b, id: crypto.randomUUID() }],
                });
                msg("本地时间意向已保存，没有预约、付款或出航放行。");
              }}
            >
              保存时间意向
            </button>
            {!s.name.trim() && (
              <button onClick={() => go(3)}>完善会员称呼</button>
            )}
            <button onClick={() => go(13)}>查看意向台账 →</button>
          </aside>
        </div>
      );
      break;
    }
    case 7:
      body = (
        <div className="td-two">
          <div>
            {text("同行者称呼", "crewName")}
            {select(
              "讨论角色",
              s.role,
              ["协调人", "参与者", "观察者"],
              (role) => change({ role }),
            )}
            <button
              disabled={s.crew.length >= 6}
              onClick={() => {
                if (!s.crewName.trim()) {
                  msg("请填写同行者称呼。");
                  return;
                }
                if (s.crew.some((x) => x.name === s.crewName.trim())) {
                  msg("请使用可区分的称呼。");
                  return;
                }
                change({
                  crew: [...s.crew, { name: s.crewName.trim(), role: s.role }],
                  crewName: "",
                });
                msg("已添加到本地讨论名单，不是实际登船名单或资格核验。");
              }}
            >
              添加同行者
            </button>
            <p>
              最多六个称呼。此人数不自动修改预约意向中的人数，避免悄悄覆盖既有安排。
            </p>
          </div>
          <div className="td-list">
            {s.crew.map((p, i) => (
              <article key={i}>
                <small>
                  0{i + 1} / {["协调人", "参与者", "观察者"][p.role]}
                </small>
                <h3>{p.name}</h3>
                <button
                  aria-label={"移除同行者 " + p.name}
                  onClick={() =>
                    change({ crew: s.crew.filter((_, n) => n !== i) })
                  }
                >
                  移除
                </button>
              </article>
            ))}
          </div>
        </div>
      );
      break;
    case 8:
      body = (
        <>
          <div className="td-two">
            {route}
            <div>
              {select(
                "草图节点",
                s.point,
                ["讨论起点", "讨论点二", "讨论点三", "讨论终点"],
                (point) => change({ point }),
              )}
              {[0, 1].map((axis) => (
                <label className="td-field" key={axis}>
                  {axis ? "纵向示意位置" : "横向示意位置"}
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={s.points[s.point][axis]}
                    onChange={(e) =>
                      change({
                        points: s.points.map((p, i) =>
                          i === s.point
                            ? p.map((n, a) =>
                                a === axis ? +e.target.value : n,
                              )
                            : p,
                        ),
                      })
                    }
                  />
                  {s.points[s.point][axis]} / 100（非坐标）
                </label>
              ))}
              {s.legs.map((d, i) => (
                <label className="td-field" key={i}>
                  航段 {i + 1} 手填距离（海里）
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.1}
                    value={d}
                    onChange={(e) =>
                      change({
                        legs: s.legs.map((v, n) =>
                          n === i
                            ? Math.max(0, Math.min(50, +e.target.value))
                            : v,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="td-three">
            {stat(
              "DISTANCE",
              c.miles + " NM",
              c.km + " km / 1 海里 = 1.852 km",
            )}
            {stat(
              "ARITHMETIC ONLY",
              c.duration + " min",
              "距离 ÷ 参考节数，未考虑风流、转向或安全。",
            )}
            {num("算术参考速度（kn）", "speed", 0.5, 15, 0.5)}
          </div>
        </>
      );
      break;
    case 9:
      body = (
        <div className="td-two">
          <div>
            {num("手填风速（kn）", "wind", 0, 100, 0.5)}
            {num("手填潮位（m）", "tide", -3, 10, 0.1)}
            {text("观测来源与时间", "source")}
            {text("环境记录备注", "conditions", true)}
          </div>
          <aside className="td-weather">
            <small>MANUAL NOTES / NOT LIVE</small>
            <div>
              <strong>{s.wind}</strong>
              <span>kn / 手动风速</span>
            </div>
            <div>
              <strong>{s.tide}</strong>
              <span>m / 手动潮位</span>
            </div>
            <p>来源：{s.source || "尚未填写"}</p>
            <b>不提供安全可航结论</b>
            <p>
              需独立核对官方预警、实际海况与运营要求，并由合格人员作出决定。
            </p>
          </aside>
        </div>
      );
      break;
    case 10:
      body = (
        <div className="td-two">
          {image("deck", "甲板设备细节")}
          <div className="td-checklist">
            {[
              "装备适配待确认",
              "通信设备待测试",
              "急救配置待核查",
              "现场规则待说明",
            ].map((v, i) => (
              <label className="td-check" key={v}>
                <input
                  type="checkbox"
                  checked={s.equipment[i]}
                  onChange={(e) =>
                    change({
                      equipment: s.equipment.map((x, n) =>
                        n === i ? e.target.checked : x,
                      ),
                    })
                  }
                />
                <span>
                  {v}
                  <small>勾选仅表示个人记录为已讨论，不代表验收合格。</small>
                </span>
              </label>
            ))}
            <p>
              个人标记 {s.equipment.filter(Boolean).length}/4；不是安全证书。
            </p>
            <button
              onClick={() =>
                change({ equipment: [false, false, false, false] })
              }
            >
              重新记录
            </button>
          </div>
        </div>
      );
      break;
    case 11:
      body = (
        <>
          <div className="td-two">
            {image("dinghy", "岸边小帆船")}
            <aside className="td-note">
              <small>LEARNING, NOT LICENSING</small>
              <h3>慢慢学，认真问。</h3>
              <p>
                学习记录不等于技术能力。真实课程、人员资质、装备与现场安排需与合格培训方确认。
              </p>
              <strong>{s.course}/4 单元手动完成</strong>
            </aside>
          </div>
          <ol className="td-course">
            {courses.map((v, i) => (
              <li key={v}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{v}</h3>
                  <p>
                    {
                      [
                        "询问现场活动范围、人员安排和需要准备的资料。",
                        "将个人期望交给教练讨论，不自行判断可执行的训练项目。",
                        "由实际专业人员决定学习内容、时长和现场条件。",
                        "记录疑问与下次目标，不把本地完成标记当作考核通过。",
                      ][i]
                    }
                  </p>
                </div>
                <button
                  disabled={s.course !== i}
                  onClick={() => change({ course: i + 1 })}
                >
                  {s.course > i ? "已手动记录" : "记录本单元完成"}
                </button>
              </li>
            ))}
          </ol>
          <button onClick={() => change({ course: 0 })}>重置学习路径</button>
        </>
      );
      break;
    case 12:
      body = (
        <div className="td-two">
          <div>
            {text("本次学习笔记", "skill", true)}
            <button
              disabled={s.skills.length >= 8}
              onClick={() => {
                if (s.skill.trim().length < 8) {
                  msg("请至少填写 8 个字符。");
                  return;
                }
                change({
                  skills: [
                    { at: new Date().toISOString(), note: s.skill },
                    ...s.skills,
                  ],
                  skill: "",
                });
                msg("独立学习笔记已保存，不是资质或考核证明。");
              }}
            >
              保存学习笔记
            </button>
          </div>
          <div>
            {s.skills.length ? (
              s.skills.map((v, i) => (
                <article className="td-note" key={i}>
                  <small>{v.at.slice(0, 10)} / SELF REPORTED</small>
                  <p>{v.note}</p>
                </article>
              ))
            ) : (
              <div className="td-empty">
                <h3>没有预填的经历。</h3>
                <p>写下真实观察与待询问的问题，再保存第一条笔记。</p>
              </div>
            )}
          </div>
        </div>
      );
      break;
    case 13:
      body = (
        <>
          <div className="td-three">
            {stat(
              "ACTIVE",
              s.intents.filter((b) => !b.cancelled).length + " 条",
              "有效本地意向，不是实际预约。",
            )}
            {stat(
              "CANCELLED",
              s.intents.filter((b) => b.cancelled).length + " 条",
              "取消仅释放本地时数与排期。",
            )}
            {stat(
              "RECORDED",
              s.logs.length + " 条",
              "手动航行日志与意向分开统计。",
            )}
          </div>
          <div className="td-intents">
            {s.intents.map((b) => (
              <article key={b.id}>
                <div>
                  <small>
                    {b.date} / {time(b.start)}–{time(b.start + b.minutes)}
                  </small>
                  <h3>{b.title}</h3>
                  <p>
                    {boats[b.boat].name} · {b.people} 人 ·{" "}
                    {b.coach ? "有教练需求" : "未记录教练需求"}
                  </p>
                </div>
                <aside>
                  <b>{b.cancelled ? "本地已取消" : "本地意向有效"}</b>
                  <button
                    disabled={b.cancelled}
                    aria-label={"取消意向 " + b.title}
                    onClick={() => {
                      if (confirm("取消本地意向？不会联系场地或退款。"))
                        change({
                          intents: s.intents.map((x) =>
                            x.id === b.id ? { ...x, cancelled: true } : x,
                          ),
                        });
                    }}
                  >
                    取消意向
                  </button>
                </aside>
              </article>
            ))}
            {!s.intents.length && (
              <div className="td-empty">
                <h3>还没有时间安排。</h3>
                <p>
                  这里不会预填其他会员的假预约。先完善称呼，再保存一条本地意向。
                </p>
                <button onClick={() => go(6)}>安排时间</button>
              </div>
            )}
          </div>
        </>
      );
      break;
    case 14:
      body = (
        <div className="td-two">
          <div>
            {date("日志日期", "logDate")}
            {num("手动航行距离（海里）", "logMiles", 0.1, 200, 0.1)}
            {num("手动实际时长（分钟）", "logMinutes", 1, 1440)}
            {text("航行观察", "logNote", true)}
            <button
              disabled={s.logs.length >= 12}
              onClick={() => {
                if (s.logNote.trim().length < 8) {
                  msg("请至少写 8 个字符说明记录来源与观察。");
                  return;
                }
                change({
                  logs: [
                    {
                      date: s.logDate,
                      miles: s.logMiles,
                      minutes: s.logMinutes,
                      note: s.logNote,
                    },
                    ...s.logs,
                  ],
                  logNote: "",
                });
                msg("手动日志已保存，没有读取 GPS 或核销会员时数。");
              }}
            >
              保存手动航行日志
            </button>
          </div>
          <aside>
            <div className="td-note">
              <small>PERSONAL LOG TOTALS</small>
              <h3>
                {c.logMiles} NM / {c.logMinutes} min
              </h3>
              <p>整体平均 {c.logSpeed} kn，按总距离 / 总时间计算。</p>
            </div>
            {s.logs.map((l, i) => (
              <article className="td-log" key={i}>
                <small>
                  {l.date} · {l.miles} NM · {l.minutes} min
                </small>
                <p>{l.note}</p>
              </article>
            ))}
          </aside>
        </div>
      );
      break;
    case 15:
      body = (
        <>
          {month}
          <div className="td-three">
            {stat(
              "MONTHLY LIMIT",
              plans[s.plan].hours + " h",
              "当前所选方案的每月规划上限。",
            )}
            {stat(
              "ACTIVE REQUESTS",
              c.hours + " h",
              "本月有效意向，取消的不占用。",
            )}
            {stat(
              "BALANCE",
              c.remaining + " h",
              c.remaining < 0
                ? "已有意向超额，调整方案或取消本地意向。"
                : "不是免费船时或真实会员余额。",
            )}
          </div>
          <div className="td-hours">
            <div
              style={{
                width:
                  Math.min(100, (c.hours / plans[s.plan].hours) * 100) + "%",
              }}
            />
            <span>
              {c.hours} / {plans[s.plan].hours} h
            </span>
          </div>
          <p>
            全部手动航行日志另计 {c.logMinutes}{" "}
            分钟，不自动核销。其他月份不占本月额度。
          </p>
          <button onClick={() => go(2)}>调整方案</button>
          <button onClick={() => go(13)}>查看意向台账</button>
        </>
      );
      break;
    case 16:
      body = (
        <div className="td-two">
          <div>
            {num("练习距离（海里）", "trialMiles", 0.1, 100, 0.1)}
            {num("练习用时（分钟）", "trialMinutes", 1, 1440)}
            <h3>{round((s.trialMiles / s.trialMinutes) * 60)} kn</h3>
            <p>本条纯算术平均，不含官方让分或风流修正。</p>
            <button
              disabled={s.trials.length >= 12}
              onClick={() => {
                change({
                  trials: [
                    ...s.trials,
                    { miles: s.trialMiles, minutes: s.trialMinutes },
                  ],
                });
                msg("个人用时已记录，没有赛事认证或公开排名。");
              }}
            >
              记录个人练习
            </button>
          </div>
          <aside className="td-note">
            <small>PERSONAL PACE / NO RANKING</small>
            <h3>整体 {c.trialSpeed} kn</h3>
            <div className="td-table">
              <table>
                <thead>
                  <tr>
                    <th>记录</th>
                    <th>海里</th>
                    <th>分钟</th>
                  </tr>
                </thead>
                <tbody>
                  {s.trials.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{r.miles}</td>
                      <td>{r.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>总距离 ÷ 总时长；不是每条速度的简单平均。</p>
          </aside>
        </div>
      );
      break;
    case 17:
      body = (
        <>
          <div className="td-event-hero">
            {image("clubhouse", "岸上会所")}
            <div>
              <small>THE CLUB, ON LAND</small>
              <h3>
                不出海的日子，
                <br />
                也值得相聚。
              </h3>
            </div>
          </div>
          <div className="td-three">
            {events.map((e, i) => (
              <article className="td-note" key={e.name}>
                <small>{e.date} / FICTIONAL EVENT</small>
                <h3>{e.name}</h3>
                <p>{e.desc}</p>
                <b>
                  上限 {e.cap} 人 · 本地意向 {s.joins[i]} 人
                </b>
                <button
                  aria-pressed={s.event === i}
                  onClick={() => change({ event: i })}
                >
                  选择{e.name}
                </button>
              </article>
            ))}
          </div>
          <div className="td-two">
            <div>
              {num("活动意向人数", "eventPeople", 1, 16)}
              <button
                disabled={s.eventPeople > events[s.event].cap}
                onClick={() => {
                  change({
                    joins: s.joins.map((n, i) =>
                      i === s.event ? s.eventPeople : n,
                    ),
                  });
                  msg("已保存本地意向，未报名或通知。");
                }}
              >
                保存岸上活动意向
              </button>
              <button
                disabled={!s.joins[s.event]}
                onClick={() =>
                  change({
                    joins: s.joins.map((n, i) => (i === s.event ? 0 : n)),
                  })
                }
              >
                取消当前活动意向
              </button>
            </div>
            <p>
              {s.eventPeople > events[s.event].cap
                ? "人数超过当前示例活动上限。"
                : "容量只用于这份本地方案，不是场地实时余位。"}
            </p>
          </div>
        </>
      );
      break;
    case 18:
      body = (
        <div className="td-two">
          <div>
            {select(
              "观察分类",
              s.issueType,
              ["船体外观", "绳索与连接", "设备现象"],
              (issueType) => change({ issueType }),
            )}
            {text("维护观察说明", "issue", true)}
            <button
              disabled={s.issues.length >= 8}
              onClick={() => {
                if (s.issue.trim().length < 8) {
                  msg("请至少填写 8 个字符描述事实。");
                  return;
                }
                change({
                  issues: [
                    {
                      at: new Date().toISOString(),
                      text: s.issue,
                      type: s.issueType,
                      closed: false,
                    },
                    ...s.issues,
                  ],
                  issue: "",
                });
                msg("本地观察已保存，未报修、未检测、未恢复适航状态。");
              }}
            >
              保存维护观察
            </button>
          </div>
          <aside>
            {image("deck", "甲板细节")}
            {s.issues.map((x, i) => (
              <article className="td-note" key={i}>
                <small>
                  {["船体外观", "绳索与连接", "设备现象"][x.type]} /{" "}
                  {x.closed ? "个人跟踪关闭" : "未发送观察"}
                </small>
                <p>{x.text}</p>
                <button
                  onClick={() =>
                    change({
                      issues: s.issues.map((v, n) =>
                        n === i ? { ...v, closed: !v.closed } : v,
                      ),
                    })
                  }
                >
                  {x.closed ? "重新打开跟踪" : "仅关闭个人跟踪"}
                </button>
                <p>不表示技师已维修或缺陷已排除。</p>
              </article>
            ))}
          </aside>
        </div>
      );
      break;
    case 19:
      body = (
        <>
          <div className="td-two">
            <div>
              {num("自带水杯计划（人）", "cups", 0, 30)}
              {num("清洁袋物料（个）", "bags", 0, 50)}
              {num("手套物料（双）", "gloves", 0, 30)}
            </div>
            <aside className="td-coast">
              <small>LEAVE A LIGHTER TRACE</small>
              <h3>
                记录计划，
                <br />
                不虚构成果。
              </h3>
              <p>
                自带水杯 {s.cups} 人。清洁袋 ¥3/个、手套 ¥8/双，物料估算{" "}
                {money(s.bags * 3 + s.gloves * 8)}
                。只在岸上按实际规则开展活动，不进入危险水域。
              </p>
            </aside>
          </div>
          <p className="td-warning">
            这些是计划数量，不是垃圾清理重量、减排量或公益认证。未实际完成前不要将其用于成果宣传。
          </p>
        </>
      );
      break;
    case 20:
      body = (
        <>
          <div className="td-three">
            {month}
            {num("示例税率（%）", "tax", 0, 20)}
            {num("项目预算（元）", "budget", 0, 100000, 100)}
          </div>
          {moneyTable}
          <p>
            预算差额 {money(s.budget - c.total)}
            。会员基础费只计所选一个月；时段费用只计同月有效意向，教练需求为
            ¥180/h。清洁物料为当前项目预算，未付款或报销。
          </p>
          <button onClick={() => csvExport(s)}>导出费用 CSV</button>
        </>
      );
      break;
    case 21:
      body = (
        <div className="td-two">
          <div>
            {text("适用地区与场地", "area")}
            {text("真实场地联系人（自行核验）", "manager")}
            {text("当地应急联络信息（自行核验）", "emergency")}
            <button
              disabled={
                !s.area.trim() || !s.manager.trim() || !s.emergency.trim()
              }
              onClick={() => {
                contactsExport(s);
                msg("已导出联络草稿，没有拨号、定位或发送求救。");
              }}
            >
              导出联络 TXT
            </button>
          </div>
          <aside className="td-contact">
            <small>VERIFY BEFORE YOU NEED IT</small>
            <h3>
              不设置一个
              <br />
              可能错误的默认号码。
            </h3>
            <p>
              号码必须按活动所在地和实际运营方确认。此处不读取位置、不核验号码有效性，也不能替代实际应急通信。
            </p>
            <b>仅存储 / 不拨号 / 不发送</b>
          </aside>
        </div>
      );
      break;
    case 22:
      body = (
        <div className="td-two">
          <div>
            <h3>当前估算 {money(c.total)}</h3>
            <p>
              {s.month} / {s.name || "未填写称呼"} / {c.hours} h 本地意向
            </p>
            <button
              disabled={
                !s.name.trim() ||
                !s.intents.some(
                  (b) => !b.cancelled && b.date.startsWith(s.month),
                )
              }
              onClick={() => {
                if (s.review && !confirm("替换原有冻结快照？请先导出备份。"))
                  return;
                change({
                  review: {
                    at: new Date().toISOString(),
                    name: s.name,
                    month: s.month,
                    selection: s.intents
                      .filter((b) => !b.cancelled && b.date.startsWith(s.month))
                      .map(
                        (b) =>
                          boats[b.boat].name +
                          " / " +
                          b.date +
                          " " +
                          time(b.start) +
                          " / " +
                          b.people +
                          "人",
                      )
                      .join("；"),
                    rows: [
                      ...c.rows.map((r) => ({ ...r })),
                      { name: "税费", amount: c.tax },
                    ],
                    total: c.total,
                    status: "confirmed",
                  },
                });
                msg("已冻结本地讨论稿，不是出航批准、合同或付款。");
              }}
            >
              冻结本地讨论稿
            </button>
            <p>
              需要称呼及所选月份至少一条有效意向。任何快照都不证明实际人员资格、装备安全或天气适宜。
            </p>
          </div>
          <aside className="td-review">
            {s.review ? (
              <>
                <small>FROZEN DISCUSSION / NOT CLEARANCE</small>
                <h3>{s.review.name}</h3>
                <p>
                  {s.review.month} / {s.review.at.slice(0, 10)}
                </p>
                <p>{s.review.selection}</p>
                <strong>{money(s.review.total)}</strong>
                <b>
                  {s.review.status === "confirmed"
                    ? "本地已确认"
                    : "本地已撤回"}
                </b>
                <button
                  disabled={s.review.status === "withdrawn"}
                  onClick={() => {
                    if (confirm("撤回本地讨论稿状态？"))
                      change({ review: { ...s.review!, status: "withdrawn" } });
                  }}
                >
                  撤回讨论稿
                </button>
              </>
            ) : (
              <>
                <small>NO SNAPSHOT YET</small>
                <h3>给讨论一个共同版本。</h3>
                <p>
                  冻结后会保留当时的称呼、月份、船只意向与费用，不随草稿变化。
                </p>
              </>
            )}
          </aside>
        </div>
      );
      break;
    default:
      body = (
        <>
          <div className="td-delivery">
            <small>THE JOURNAL, READY TO SHARE</small>
            <h3>
              一份可以带走的计划，
              <br />
              不是一张出航许可。
            </h3>
            <div>
              {[
                ["项目 JSON", () => jsonExport(s)],
                ["费用 CSV", () => csvExport(s)],
                ["示意 SVG", () => svgExport(s)],
                ["24 章离线 HTML", () => htmlExport(s)],
              ].map(([name, fn]) => (
                <button
                  key={String(name)}
                  disabled={busy}
                  onClick={() => void execute(fn as () => Promise<void> | void)}
                >
                  {busy ? "正在生成…" : String(name)}
                </button>
              ))}
            </div>
          </div>
          <label className="td-field">
            导入 TIDE 项目
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
                    v.format !== "tide-project-v1" ||
                    typeof v.state?.project !== "string"
                  )
                    throw Error("不是 TIDE 项目文件。");
                  if (confirm("替换当前草稿？")) patch(restore(v.state));
                } catch (e) {
                  msg(e instanceof Error ? e.message : "导入失败。");
                }
              }}
            />
          </label>
          <p>
            离线 HTML 内嵌五张专用 AI 图与中文字体许可证。JSON
            不含本机命名版本历史，服务器保存为显式快照。联络卡片请在第 22
            页填写并导出；不会自动发送任何文件或信息。
          </p>
          {route}
        </>
      );
  }
  return (
    <main className="tide-work">
      <SampleTop
        type="原型 / 24 个会员规划页面"
        title="TIDE · 帆船俱乐部会员"
        draftId={draftId}
        onCopy={() => {
          try {
            copySample("tide", s);
          } catch {
            msg("副本保存失败，请先导出备份。");
          }
        }}
      >
        <button onClick={() => go(23)}>交付手记</button>
      </SampleTop>
      <Notice text={error || notice} />
      {controls}
      <div className="td-shell">
        <header className="td-masthead">
          <b>
            TIDE<span>SAILING CLUB / MEMBERS JOURNAL</span>
          </b>
          <div>
            <small>YOUR PRIVATE NOTEBOOK</small>
            <strong>{s.project}</strong>
          </div>
          <span>
            LAND & SEA
            <br />
            EST. IN IMAGINATION
          </span>
        </header>
        <nav className="td-index" aria-label="TIDE 页面目录">
          {pages.map((p, i) => (
            <button
              key={p[0]}
              aria-label={p[0]}
              aria-current={s.page === i ? "page" : undefined}
              onClick={() => go(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <small>{p[0]}</small>
            </button>
          ))}
        </nav>
        <section
          className={"td-page td-page-" + s.page}
          data-page={s.page}
          aria-label={pages[s.page][0]}
        >
          {s.page > 0 && (
            <header className="td-heading">
              <small>
                CHAPTER {String(s.page + 1).padStart(2, "0")} /{" "}
                {pages[s.page][0]}
              </small>
              <h1>{pages[s.page][1]}</h1>
              <p>{pages[s.page][2]}</p>
            </header>
          )}
          {body}
          <footer>
            <span>
              {String(s.page + 1).padStart(2, "0")} / 24 ·
              仅本地规划，非真实出航业务
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
