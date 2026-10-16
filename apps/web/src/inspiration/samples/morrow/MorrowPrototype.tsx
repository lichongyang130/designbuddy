import { useState, type ReactNode } from "react";
import { SampleTop, Notice, copySample } from "../shared";
import { useDraftTools } from "../DraftTools";
import {
  pages,
  beans,
  initial,
  restore,
  calculate,
  label,
  unit,
  item,
  makeQueue,
  balance,
  blendValid,
  money,
  round,
  validDate,
  addDays,
  type State,
} from "./model";
import { images } from "./images";
import {
  recipeSVG,
  timesValid,
  jsonExport,
  csvExport,
  svgExport,
  htmlExport,
  requestExport,
} from "./delivery";
import "./morrow.css";
export default function MorrowPrototype({ draftId }: { draftId?: string }) {
  const {
      state: s,
      patch,
      go,
      error,
      notice,
      msg,
      controls,
    } = useDraftTools("morrow", draftId, initial, restore),
    [busy, setBusy] = useState(false),
    c = calculate(s);
  const change = (p: Partial<State>) => patch(restore({ ...s, ...p }));
  const text = (name: string, key: keyof State, multi = false) => (
    <label className="mr-field">
      {name}
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
    name: string,
    key: keyof State,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="mr-field">
      {name}
      <input
        type="number"
        aria-label={name}
        min={min}
        max={max}
        step={step}
        value={s[key] as number}
        onChange={(e) => {
          const n = +e.target.value;
          if (Number.isFinite(n))
            change({ [key]: Math.max(min, Math.min(max, n)) });
        }}
      />
    </label>
  );
  const select = (
    name: string,
    value: number,
    options: readonly string[],
    fn: (n: number) => void,
  ) => (
    <label className="mr-field">
      {name}
      <select value={value} onChange={(e) => fn(+e.target.value)}>
        {options.map((v, i) => (
          <option key={v} value={i}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
  const date = (name: string, key: "start" | "roasted" | "observed") => (
    <label className="mr-field">
      {name}
      <input
        type="date"
        value={s[key]}
        onChange={(e) => {
          if (validDate(e.target.value)) change({ [key]: e.target.value });
        }}
      />
    </label>
  );
  const photo = (key: keyof typeof images, alt: string) => (
    <img
      className="mr-photo"
      loading="lazy"
      src={images[key]}
      alt={alt + "（AI 概念图）"}
    />
  );
  const stat = (name: string, value: string, note: string) => (
    <article className="mr-stat">
      <small>{name}</small>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
  const chart = timesValid(s) ? (
    <div
      className="mr-chart"
      dangerouslySetInnerHTML={{ __html: recipeSVG(s) }}
    />
  ) : (
    <p className="mr-warning">请按递增顺序填写三个时间节点。</p>
  );
  const flavor = (profile: number[]) => (
    <div className="mr-flavor">
      {profile.map((v, i) => (
        <div key={i}>
          <span>{["果香", "甜感", "醇厚"][i]}</span>
          <meter min={0} max={5} value={v} />
          <small>{round(v)} / 5</small>
        </div>
      ))}
    </div>
  );
  const quote = (
    <div className="mr-table">
      <table>
        <thead>
          <tr>
            <th>条目</th>
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
      <div className="mr-total">
        <span>税费 {money(c.tax)}</span>
        <strong data-testid="morrow-total">{money(c.total)}</strong>
      </div>
    </div>
  );
  const execute = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
      msg("文件已生成，没有订阅、付款或发送。");
    } catch (e) {
      msg(e instanceof Error ? e.message : "导出失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  let body: ReactNode;
  switch (s.page) {
    case 0:
      body = (
        <>
          <div className="mr-hero">
            <div>
              <small>THE SLOW MORNING CLUB</small>
              <h1>
                Good things
                <br />
                take a<br />
                <em>little brewing.</em>
              </h1>
              <p>
                让一杯咖啡，
                <br />
                成为刚刚好的日常。
              </p>
              <button onClick={() => go(1)}>从你的风味偏好开始 ↗</button>
            </div>
            {photo("ritual", "晨间手冲咖啡")}
          </div>
          <div className="mr-three">
            {stat(
              "TASTE FIRST",
              "先品味",
              "从个人偏好，而非虚构的公共星级开始。",
            )}
            {stat("FIND A RHYTHM", "找节奏", "用量、间隔与库存一起计算。")}
            {stat("KEEP A NOTE", "留记录", "保存真正属于自己的一杯。")}
          </div>
          <p>{pages[0][2]}</p>
        </>
      );
      break;
    case 1:
      body = (
        <div className="mr-two">
          <div>
            {text("项目名称", "project")}
            {s.preferences.map((v, i) => (
              <label className="mr-field" key={i}>
                {["果香偏好", "甜感偏好", "醇厚偏好"][i]}
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={v}
                  onChange={(e) =>
                    change({
                      preferences: s.preferences.map((x, n) =>
                        n === i ? +e.target.value : x,
                      ),
                    })
                  }
                />
                {v} / 5
              </label>
            ))}
          </div>
          <aside className="mr-note">
            <small>YOUR LOCAL MATCH</small>
            <h3>{beans[c.recommend].name}</h3>
            <p>{beans[c.recommend].notes}</p>
            {flavor(beans[c.recommend].profile)}
            <p>本地算法按三项偏好的距离排序；不是 AI 味觉分析或品质评分。</p>
            <button
              onClick={() =>
                patch({ bean: c.recommend, blend: false, page: 3 })
              }
            >
              查看这款示例豆 →
            </button>
          </aside>
        </div>
      );
      break;
    case 2:
      body = (
        <>
          <div className="mr-origin">
            {photo("cherries", "咖啡樱桃")}
            <div>
              <small>IMAGINED ORIGINS / REAL CURIOSITY</small>
              <h3>
                从一颗果实，
                <br />
                开始好奇。
              </h3>
              <p>图像不是具体农场的溯源证明。三款名称是风味讨论的虚构代号。</p>
            </div>
          </div>
          <div className="mr-three">
            {beans.map((b, i) => (
              <article className="mr-bean" key={b.name}>
                <small>NO. 0{i + 1} / COFFEE STUDY</small>
                <h3>{b.name}</h3>
                <p>{b.notes}</p>
                {flavor(b.profile)}
                <b>{money(b.price)} / 250g</b>
                <button
                  onClick={() => patch({ bean: i, blend: false, page: 3 })}
                >
                  研究{b.name}
                </button>
              </article>
            ))}
          </div>
        </>
      );
      break;
    case 3:
      body = (
        <div className="mr-two">
          {photo("beans", "烘焙咖啡豆")}
          <div>
            {select(
              "当前单豆",
              s.bean,
              beans.map((b) => b.name),
              (bean) => change({ bean, blend: false }),
            )}
            <h3>{beans[s.bean].notes}</h3>
            <p>
              {beans[s.bean].process} / {beans[s.bean].roast}
            </p>
            {flavor(beans[s.bean].profile)}
            <h3>
              {money(unit({ ...s, blend: false }))} / {s.grams}g
            </h3>
            <p>500g 袋按两份 250g 价格的 95% 演算，非实际优惠承诺。</p>
            <button onClick={() => patch({ blend: false, page: 6 })}>
              选用这款单豆并配置 →
            </button>
          </div>
        </div>
      );
      break;
    case 4:
      body = (
        <div className="mr-two">
          <div>
            {photo("beans", "拼配咖啡豆")}
            <p>比例改变的是数值与描述，不会重新生成或修改照片。</p>
          </div>
          <div>
            <label className="mr-check">
              <input
                type="checkbox"
                checked={s.blend}
                onChange={(e) => change({ blend: e.target.checked })}
              />
              启用自定义拼配
            </label>
            {s.ratios.map((v, i) => (
              <label className="mr-field" key={i}>
                {beans[i].name} 比例（%）
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={v}
                  onChange={(e) =>
                    change({
                      ratios: s.ratios.map((x, n) =>
                        n === i
                          ? Math.max(0, Math.min(100, +e.target.value))
                          : x,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <p className="mr-warning">
              合计 {round(s.ratios.reduce((a, b) => a + b, 0))}% ·{" "}
              {blendValid(s)
                ? s.blend
                  ? "比例可用于本地方案"
                  : "当前仍使用单豆"
                : "比例必须合计 100%，暂不能加入清单或生成计划"}
            </p>
            {flavor(
              [0, 1, 2].map((i) =>
                beans.reduce(
                  (a, b, j) => a + (b.profile[i] * s.ratios[j]) / 100,
                  0,
                ),
              ),
            )}
          </div>
        </div>
      );
      break;
    case 5:
      body = (
        <div className="mr-two">
          <div>
            {select("冲煮器具", s.method, ["手冲", "意式", "浸泡"], (method) =>
              change({ method }),
            )}
            {select(
              "研磨需求",
              s.grind,
              ["整豆", "手冲研磨", "意式研磨", "浸泡研磨"],
              (grind) => change({ grind }),
            )}
            <p>保存到清单或四期计划时，会冻结当时的研磨说明。</p>
          </div>
          <aside className="mr-note">
            <small>GRIND IS A CONVERSATION</small>
            <h3>
              {
                [
                  "从均匀流速开始观察。",
                  "按实际设备与指导调节。",
                  "把时间与过滤方式一起考虑。",
                ][s.method]
              }
            </h3>
            <p>
              不提供跨设备通用刻度，不控制磨豆机。若需代磨，请向实际商家说明器具与个人冲煮方式。
            </p>
            <button onClick={() => go(8)}>打开配方实验室 →</button>
          </aside>
        </div>
      );
      break;
    case 6:
      body = (
        <>
          <div className="mr-three">
            {select(
              "每袋规格",
              s.grams === 250 ? 0 : 1,
              ["250g", "500g"],
              (n) => change({ grams: n ? 500 : 250 }),
            )}
            {num("每期袋数", "qty", 1, 6)}
            {num("间隔周数", "weeks", 1, 4)}
          </div>
          <div className="mr-three">
            {stat("SUPPLY", s.grams * s.qty + " g", "每个周期的计划供应量。")}
            {stat("USE", c.cycleUse + " g", "人数 × 杯数 × 粉量 × 间隔天数。")}
            {stat(
              "DIFFERENCE",
              round(s.grams * s.qty - c.cycleUse) + " g",
              "正值为多于演算用量，负值为不足。",
            )}
          </div>
          <p>
            当前 {label(s)} / {money(unit(s))} 每袋。不自动订阅或补货。
            {!blendValid(s) && " 拼配比例未达 100%，请回到拼配实验修正。"}
          </p>
          <button
            disabled={!blendValid(s) || s.cart.length >= 12}
            onClick={() => {
              change({ cart: [...s.cart, item(s)] });
              msg("独立配置已加入本地清单，未下单。");
            }}
          >
            加入单次清单
          </button>
          <button onClick={() => go(12)}>规划四期日期 →</button>
        </>
      );
      break;
    case 7:
      body = (
        <>
          <div className="mr-three">
            {num("饮用人数", "persons", 1, 8)}
            {num("每人每日杯数", "cups", 1, 8)}
            {num("每杯粉量（g）", "dose", 5, 60, 0.5)}
          </div>
          <div className="mr-three">
            {stat(
              "DAILY USE",
              c.daily + " g",
              "仅消费习惯演算，不是建议饮用量。",
            )}
            {stat(
              "PANTRY",
              balance(s) + " g",
              "初始示例库存 + 手动入库 − 手动消耗。",
            )}
            {stat(
              "COVERAGE",
              c.coverage + " 天",
              "按当前日用量计算，不含尚未到手的订阅计划。",
            )}
          </div>
          <button onClick={() => go(17)}>打开个人库存台账</button>
        </>
      );
      break;
    case 8:
      body = (
        <>
          <div className="mr-three">
            {num("配方咖啡粉（g）", "dose", 5, 60, 0.5)}
            {num("粉水比（1 : x）", "ratio", 10, 20, 0.5)}
            {num("参考水温（℃）", "temp", 70, 100)}
          </div>
          <div className="mr-recipe">
            <div>
              <small>TOTAL WATER</small>
              <strong>
                {c.water}
                <span>ml</span>
              </strong>
              <p>
                {s.dose} g × {s.ratio}，不含成品液量推断。
              </p>
            </div>
            <ol>
              {c.pours.map((n, i) => (
                <li key={i}>
                  <span>0{i + 1}</span>
                  <div>
                    <b>{["闷蒸", "第一段", "第二段"][i]}</b>
                    <strong>{n} ml</strong>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <button onClick={() => go(9)}>查看累计注水图 →</button>
          <p>
            各段合计 {round(c.pours.reduce((a, b) => a + b, 0))}{" "}
            ml。注意热水与器具使用安全；真实流速由实际冲煮观察决定。
          </p>
        </>
      );
      break;
    case 9:
      body = (
        <>
          <div className="mr-two">
            {chart}
            <div>
              {s.times.map((v, i) => (
                <label className="mr-field" key={i}>
                  {["闷蒸结束", "第一段结束", "第二段结束"][i]}（秒）
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={v}
                    onChange={(e) =>
                      change({
                        times: s.times.map((x, n) =>
                          n === i
                            ? Math.max(1, Math.min(600, +e.target.value))
                            : x,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <p>
                时间节点必须严格递增；不是实时计时、电子秤曲线或萃取自动控制。
              </p>
              <button
                disabled={!timesValid(s) || busy}
                onClick={() => void execute(() => svgExport(s))}
              >
                导出注水 SVG
              </button>
            </div>
          </div>
        </>
      );
      break;
    case 10:
      body = (
        <>
          <div className="mr-basket">
            {s.cart.map((x) => (
              <article key={x.id}>
                <div>
                  <small>LOCAL LIST / FROZEN CONFIGURATION</small>
                  <h3>{x.label}</h3>
                  <p>
                    {x.grams}g × {x.qty} 袋 / {money(x.unit)} 每袋
                  </p>
                </div>
                <div>
                  <b>{money(x.qty * x.unit)}</b>
                  <button
                    aria-label={"移除清单 " + x.label}
                    onClick={() =>
                      change({ cart: s.cart.filter((v) => v.id !== x.id) })
                    }
                  >
                    移除条目
                  </button>
                </div>
              </article>
            ))}
            {!s.cart.length && (
              <div className="mr-empty">
                <h3>先找到你的那一杯。</h3>
                <p>
                  清单没有预装假订单。配置豆款、规格和袋数后，保存独立条目。
                </p>
                <button onClick={() => go(6)}>配置并加入清单</button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              patch({ mode: 0, page: 20 });
            }}
          >
            按单次清单核算 →
          </button>
        </>
      );
      break;
    case 11:
      body = (
        <div className="mr-two">
          <div>
            {text("收件称呼", "name")}
            {text("沟通方式（不发送）", "contact")}
            {text("交付与包装备注", "delivery", true)}
          </div>
          {photo("parcel", "无品牌包装概念")}
        </div>
      );
      break;
    case 12:
      body = (
        <>
          {date("第一期计划日期", "start")}
          <p>
            当前配置：{label(s)} / {s.grams}g × {s.qty}，间隔 {s.weeks}{" "}
            周。生成后保留独立价格和配置；不是发货承诺。
          </p>
          <button
            disabled={
              !blendValid(s) || !validDate(addDays(s.start, s.weeks * 21))
            }
            onClick={() => {
              if (
                s.queue.length &&
                !confirm("替换现有四期计划？旧计划不会自动存档。")
              )
                return;
              change({ queue: makeQueue(s) });
              msg("四期本地计划已生成，未订阅、未付款、未发货。");
            }}
          >
            生成四期计划
          </button>
          {!validDate(addDays(s.start, s.weeks * 21)) && (
            <p>最后一期超出支持日期范围，请调整开始日期。</p>
          )}
          <div className="mr-cycles">
            {s.queue.map((x, i) => (
              <article key={x.id}>
                <small>DELIVERY PLAN / 0{i + 1}</small>
                <h3>{x.label}</h3>
                <label className="mr-field">
                  第 {i + 1} 期日期
                  <input
                    type="date"
                    value={x.date}
                    onChange={(e) => {
                      if (validDate(e.target.value))
                        change({
                          queue: s.queue.map((v, n) =>
                            n === i ? { ...v, date: e.target.value } : v,
                          ),
                        });
                    }}
                  />
                </label>
                <p>
                  {x.grams}g × {x.qty} / {money(x.unit)}每袋
                </p>
                <label className="mr-check">
                  <input
                    type="checkbox"
                    checked={x.skip}
                    onChange={(e) =>
                      change({
                        queue: s.queue.map((v, n) =>
                          n === i ? { ...v, skip: e.target.checked } : v,
                        ),
                      })
                    }
                  />
                  本地跳过第 {i + 1} 期
                </label>
                <b>{x.skip ? "不计入费用" : "仅本地计划"}</b>
              </article>
            ))}
          </div>
          <button onClick={() => patch({ mode: 1, page: 20 })}>
            按四期计划核算 →
          </button>
        </>
      );
      break;
    case 13:
      body = (
        <div className="mr-two">
          <article className={"mr-pause " + (s.paused ? "paused" : "")}>
            <small>YOUR RHYTHM, YOUR CHOICE</small>
            <h3>{s.paused ? "本地计划已暂停。" : "本地计划正在演算。"}</h3>
            <p>
              已有 {s.queue.length} 期记录，
              {s.queue.filter((x) => !x.skip).length}{" "}
              期未跳过。暂停时不计四期计划费用，单次清单保持独立。
            </p>
            <button
              onClick={() => {
                change({ paused: !s.paused });
                msg(
                  s.paused
                    ? "已恢复本地演算，未恢复任何真实扣款。"
                    : "已暂停本地演算，没有向商家发出取消指令。",
                );
              }}
            >
              {s.paused ? "恢复本地计划" : "暂停本地计划"}
            </button>
          </article>
          <aside className="mr-note">
            <small>NO HIDDEN RENEWALS</small>
            <h3>
              没有自动续订，
              <br />
              也没有后台发货。
            </h3>
            <p>
              恢复不会推移日期。若计划已经过时，请回到四期页面复核或重新生成。真实订阅必须联系实际服务商。
            </p>
            <button onClick={() => go(12)}>复核计划日期 →</button>
          </aside>
        </div>
      );
      break;
    case 14:
      body = (
        <div className="mr-two">
          <div>
            {text("本次冲煮观察", "brewNote", true)}
            <p>
              当前 {label(s)} / {s.dose}g / 1:{s.ratio} / {s.temp}
              ℃，保存后独立保留。
            </p>
            <button
              disabled={s.brews.length >= 10 || !blendValid(s)}
              onClick={() => {
                if (s.brewNote.trim().length < 8) {
                  msg("请至少填写 8 个字符的观察。");
                  return;
                }
                change({
                  brews: [
                    {
                      at: new Date().toISOString(),
                      label: label(s),
                      dose: s.dose,
                      ratio: s.ratio,
                      temp: s.temp,
                      note: s.brewNote,
                    },
                    ...s.brews,
                  ],
                  brewNote: "",
                });
                msg("独立冲煮笔记已保存，没有扣除库存。");
              }}
            >
              保存这杯笔记
            </button>
          </div>
          <aside>
            {s.brews.map((b, i) => (
              <article className="mr-note" key={i}>
                <small>{b.at.slice(0, 10)} / PERSONAL BREW</small>
                <h3>{b.label}</h3>
                <b>
                  {b.dose}g / 1:{b.ratio} / {b.temp}℃
                </b>
                <p>{b.note}</p>
              </article>
            ))}
            {!s.brews.length && (
              <div className="mr-empty">
                <h3>第一杯，从真实观察开始。</h3>
                <p>记录香气、流速和口感，不预装虚假的冲煮经历。</p>
              </div>
            )}
          </aside>
        </div>
      );
      break;
    case 15:
      body = (
        <div className="mr-two">
          <div>
            {select(
              "个人品鉴分数",
              s.rating - 1,
              ["1 分", "2 分", "3 分", "4 分", "5 分"],
              (n) => change({ rating: n + 1 }),
            )}
            {text("品鉴说明", "tasting", true)}
            <button
              disabled={s.tastings.length >= 10}
              onClick={() => {
                if (s.tasting.trim().length < 8) {
                  msg("请至少填写 8 个字符。");
                  return;
                }
                change({
                  tastings: [
                    { rating: s.rating, note: s.tasting },
                    ...s.tastings,
                  ],
                  tasting: "",
                });
                msg("个人品鉴已记录，没有发布商家评价。");
              }}
            >
              保存个人品鉴
            </button>
          </div>
          <aside>
            <h3>
              {s.tastings.length
                ? (
                    s.tastings.reduce((a, b) => a + b.rating, 0) /
                    s.tastings.length
                  ).toFixed(1) + " / 5"
                : "尚无个人评分"}
            </h3>
            <p>
              仅此方案内 {s.tastings.length}{" "}
              条主观记录，不是公共口碑或杯测认证。
            </p>
            {s.tastings.map((t, i) => (
              <article className="mr-note" key={i}>
                <small>{t.rating} / 5</small>
                <p>{t.note}</p>
              </article>
            ))}
          </aside>
        </div>
      );
      break;
    case 16:
      body = (
        <div className="mr-two">
          <div>
            {select(
              "替换目标期",
              s.cycle,
              ["第一期", "第二期", "第三期", "第四期"],
              (cycle) => change({ cycle }),
            )}
            {select(
              "轮换单豆",
              s.replacement,
              beans.map((b) => b.name),
              (replacement) => change({ replacement }),
            )}
            <button
              disabled={!s.queue[s.cycle]}
              onClick={() => {
                const b = beans[s.replacement];
                change({
                  queue: s.queue.map((x, i) =>
                    i === s.cycle
                      ? {
                          ...x,
                          label:
                            b.name +
                            " / " +
                            ["整豆", "手冲研磨", "意式研磨", "浸泡研磨"][
                              s.grind
                            ],
                          unit: round(
                            ((b.price * x.grams) / 250) *
                              (x.grams === 500 ? 0.95 : 1),
                          ),
                        }
                      : x,
                  ),
                });
                msg("只更新这一期的本地配置与单位价格，未通知商家。");
              }}
            >
              替换所选期咖啡
            </button>
            <p>
              采用当前研磨需求，保留目标期的日期、规格、数量及跳过状态。先生成四期计划才能替换。
            </p>
          </div>
          <aside className="mr-note">
            <small>ONE CYCLE AT A TIME</small>
            <h3>{s.queue[s.cycle]?.label || "尚无这一期计划"}</h3>
            {s.queue[s.cycle] && (
              <p>
                {s.queue[s.cycle].date} / {s.queue[s.cycle].grams}g ×{" "}
                {s.queue[s.cycle].qty} / {money(s.queue[s.cycle].unit)}每袋
              </p>
            )}
            <button onClick={() => go(12)}>查看全部四期 →</button>
          </aside>
        </div>
      );
      break;
    case 17:
      body = (
        <div className="mr-two">
          <div>
            {select(
              "库存记录类型",
              s.stockMode,
              ["手动入库", "手动消耗"],
              (stockMode) => change({ stockMode }),
            )}
            {num("库存记录数量（g）", "stockAmount", 1, 2000)}
            {text("库存记录说明", "stockNote", true)}
            <button
              disabled={s.stock.length >= 20}
              onClick={() => {
                if (!s.stockNote.trim()) {
                  msg("请填写库存记录说明。");
                  return;
                }
                const delta = s.stockMode ? -s.stockAmount : s.stockAmount;
                if (balance(s) + delta < 0) {
                  msg("消耗超过现有库存，未扣除。");
                  return;
                }
                change({
                  stock: [
                    ...s.stock,
                    { delta, note: s.stockNote, at: new Date().toISOString() },
                  ],
                  stockNote: "",
                });
                msg("手动库存已更新，没有商家库存或自动补货动作。");
              }}
            >
              保存库存记录
            </button>
          </div>
          <aside>
            <div className="mr-stock">
              <small>PERSONAL PANTRY</small>
              <strong>{balance(s)} g</strong>
              <p>500g 示例起始库存 + 已保存台账</p>
            </div>
            {s.stock.map((x, i) => (
              <article className="mr-note" key={i}>
                <b>
                  {x.delta > 0 ? "+" : ""}
                  {x.delta} g
                </b>
                <p>{x.note}</p>
                <small>{x.at.slice(0, 10)}</small>
              </article>
            ))}
          </aside>
        </div>
      );
      break;
    case 18:
      body = (
        <div className="mr-two">
          {photo("roaster", "烘焙工作室")}
          <div>
            {date("烘焙日期", "roasted")}
            {date("观察日期", "observed")}
            <h3>{c.age >= 0 ? c.age + " 天" : "日期顺序待复核"}</h3>
            <p>
              {c.age >= 0
                ? "只表示两个手填日期之间的差值，不判断品质、安全或保质期。"
                : "烘焙日期晚于观察日期；请核对记录，不生成错误的“新鲜度”结论。"}
            </p>
            <p>遵循真实产品标签与储存要求，避免将示例时间当作安全食用建议。</p>
          </div>
        </div>
      );
      break;
    case 19:
      body = (
        <div className="mr-two">
          {photo("parcel", "订阅包装概念")}
          <div>
            {num("礼盒需求（个）", "gift", 0, 10)}
            <label className="mr-check">
              <input
                type="checkbox"
                checked={s.pack}
                onChange={(e) => change({ pack: e.target.checked })}
              />
              希望减少一次性包装
            </label>
            <h3>{money(s.gift * 10)}</h3>
            <p>
              礼盒示例
              ¥10/个。不影响免运费门槛；四期计划暂停时该口径的包装费也不计。包装意向未发送给商家，不代表减排或回收认证。
            </p>
          </div>
        </div>
      );
      break;
    case 20:
      body = (
        <>
          <div className="mr-three">
            {select("费用口径", s.mode, ["单次清单", "四期计划"], (mode) =>
              change({ mode }),
            )}
            {num("咖啡示例折扣（%）", "discount", 0, 30)}
            {num("示例税率（%）", "tax", 0, 20)}
          </div>
          {quote}
          {num("项目预算（元）", "budget", 0, 100000, 100)}
          <p className="mr-warning">
            预算差额 {money(s.budget - c.total)}。折后咖啡金额满 ¥199
            免对应运费，否则 ¥15；包装不参与门槛。
            {s.mode
              ? s.paused
                ? "当前四期计划暂停，不计费。"
                : "四期计划逐期核算运费，跳过期不计费。"
              : "单次清单合并核算运费，不叠加四期计划。"}
          </p>
          <button onClick={() => csvExport(s)}>导出费用 CSV</button>
        </>
      );
      break;
    case 21:
      body = (
        <div className="mr-two">
          <div>
            {text("售后问题与期望", "issue", true)}
            <button
              disabled={s.issue.trim().length < 8}
              onClick={() => {
                requestExport(s);
                msg("售后草稿已生成，未发送、未受理或退款。");
              }}
            >
              导出售后 TXT
            </button>
          </div>
          <aside className="mr-note">
            <small>WRITE IT DOWN, SEND IT YOURSELF</small>
            <h3>
              先记录事实，
              <br />
              再联系实际商家。
            </h3>
            <p>
              建议描述时间、配置与看到的现象，不录入支付密码等敏感资料。本模板不会生成工单编号或假装客服已受理。
            </p>
          </aside>
        </div>
      );
      break;
    case 22:
      body = (
        <div className="mr-two">
          <div>
            <h3>当前讨论金额 {money(c.total)}</h3>
            <p>
              {s.mode ? "四期计划" : "单次清单"} / {s.name || "尚未填写称呼"}
            </p>
            <button
              disabled={!s.name.trim() || c.total <= 0}
              onClick={() => {
                if (s.review && !confirm("替换现有冻结讨论稿？")) return;
                change({
                  review: {
                    at: new Date().toISOString(),
                    name: s.name,
                    mode: s.mode ? "四期计划" : "单次清单",
                    rows: [
                      ...c.rows.map((r) => ({ ...r })),
                      { name: "税费", amount: c.tax },
                    ],
                    total: c.total,
                    withdrawn: false,
                  },
                });
                msg("讨论稿已冻结，不是订单、付款或配送承诺。");
              }}
            >
              冻结讨论确认稿
            </button>
            <p>
              需要称呼与非零预算。真实交易、产品标签与配送要求必须向实际商家确认。
            </p>
          </div>
          <aside className="mr-review">
            {s.review ? (
              <>
                <small>FROZEN ESTIMATE / NOT AN ORDER</small>
                <h3>{s.review.name}</h3>
                <p>
                  {s.review.mode} / {s.review.at.slice(0, 10)}
                </p>
                {s.review.rows.map((r, i) => (
                  <div key={i}>
                    <span>{r.name}</span>
                    <b>{money(r.amount)}</b>
                  </div>
                ))}
                <strong>{money(s.review.total)}</strong>
                <p>{s.review.withdrawn ? "本地已撤回" : "本地讨论确认"}</p>
                <button
                  disabled={s.review.withdrawn}
                  onClick={() => {
                    if (confirm("撤回本地讨论稿？"))
                      change({ review: { ...s.review!, withdrawn: true } });
                  }}
                >
                  撤回讨论稿
                </button>
              </>
            ) : (
              <>
                <h3>还没有冻结版本。</h3>
                <p>确认时会固定当前条目与价格，避免以后改动混淆讨论。</p>
              </>
            )}
          </aside>
        </div>
      );
      break;
    default:
      body = (
        <>
          <div className="mr-delivery">
            <small>TAKE YOUR MORNING WITH YOU</small>
            <h3>
              一杯接一杯，
              <br />
              让记录慢慢积累。
            </h3>
            <div>
              {[
                ["项目 JSON", () => jsonExport(s)],
                ["费用 CSV", () => csvExport(s)],
                ["配方 SVG", () => svgExport(s)],
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
          <label className="mr-field">
            导入 MORROW 项目
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
                    v.format !== "morrow-project-v1" ||
                    typeof v.state?.project !== "string"
                  )
                    throw Error("不是 MORROW 项目文件。");
                  if (confirm("替换当前草稿？")) patch(restore(v.state));
                } catch (e) {
                  msg(e instanceof Error ? e.message : "导入失败。");
                }
              }}
            />
          </label>
          <p>
            HTML 内嵌五张专用 AI 概念图与中文字体。JSON
            不含本机命名版本；服务器为显式快照。没有商家库存、真实订阅、支付、运单、物流或电子秤连接。
          </p>
          {chart}
        </>
      );
  }
  return (
    <main className="morrow-work">
      <SampleTop
        type="原型 / 24 个咖啡规划页面"
        title="MORROW · 精品咖啡订阅"
        draftId={draftId}
        onCopy={() => {
          try {
            copySample("morrow", s);
          } catch {
            msg("副本保存失败，请先导出。");
          }
        }}
      >
        <button onClick={() => go(23)}>交付记录</button>
      </SampleTop>
      <Notice text={error || notice} />
      {controls}
      <div className="mr-shell">
        <header className="mr-brand">
          <b>
            morrow<span>COFFEE, AT YOUR OWN PACE.</span>
          </b>
          <span>{s.project}</span>
          <button onClick={() => go(10)}>本地清单 / {s.cart.length}</button>
        </header>
        <nav className="mr-nav" aria-label="MORROW 导航">
          <div>
            {["寻找风味", "配置节奏", "留下记录", "整理交付"].map((v, i) => (
              <button
                key={v}
                aria-current={Math.floor(s.page / 6) === i ? "page" : undefined}
                onClick={() => go(i * 6)}
              >
                {v}
              </button>
            ))}
          </div>
          <select
            aria-label="MORROW 页面目录"
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
          className={"mr-page mr-page-" + s.page}
          data-page={s.page}
          aria-label={pages[s.page][0]}
        >
          {s.page > 0 && (
            <header className="mr-heading">
              <small>
                COFFEE JOURNAL / {String(s.page + 1).padStart(2, "0")}
              </small>
              <h1>{pages[s.page][1]}</h1>
              <p>{pages[s.page][2]}</p>
            </header>
          )}
          {body}
          <footer>
            <span>
              {String(s.page + 1).padStart(2, "0")} / 24 · 个人计划，非真实订阅
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
