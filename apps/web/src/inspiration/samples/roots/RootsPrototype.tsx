import { useState, type ReactNode } from "react";
import { SampleTop, Notice, copySample } from "../shared";
import { useDraftTools } from "../DraftTools";
import {
  pages,
  plants,
  phases,
  initial,
  restore,
  calculate,
  overlaps,
  money,
  type State,
} from "./model";
import { images } from "./images";
import {
  planSVG,
  jsonExport,
  csvExport,
  svgExport,
  htmlExport,
} from "./delivery";
import "./roots.css";
export default function RootsPrototype({ draftId }: { draftId?: string }) {
  const {
      state: s,
      patch,
      go,
      error,
      notice,
      msg,
      controls,
    } = useDraftTools("roots", draftId, initial, restore),
    [busy, setBusy] = useState(false),
    c = calculate(s),
    plant = plants[s.selected];
  const change = (p: Partial<State>) => patch(restore({ ...s, ...p }));
  const num = (
    label: string,
    key: keyof State,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="rt-field">
      {label}
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={s[key] as number}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n))
            change({ [key]: Math.max(min, Math.min(max, n)) });
        }}
      />
    </label>
  );
  const text = (
    label: string,
    key: "project" | "brief" | "notes" | "reviewer",
    multi = false,
  ) => (
    <label className="rt-field">
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
  const select = (
    label: string,
    value: number,
    options: readonly string[],
    fn: (n: number) => void,
  ) => (
    <label className="rt-field">
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
  const image = (name: keyof typeof images, alt: string) => (
    <img
      className="rt-photo"
      loading="lazy"
      src={images[name]}
      alt={alt + "（AI 概念图）"}
    />
  );
  const stat = (label: string, value: string, note: string) => (
    <article className="rt-stat">
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
  const check = (
    labels: string[],
    values: boolean[],
    fn: (v: boolean[]) => void,
  ) => (
    <div className="rt-checks">
      {labels.map((v, i) => (
        <label key={v}>
          <input
            type="checkbox"
            checked={values[i]}
            onChange={(e) =>
              fn(values.map((x, n) => (n === i ? e.target.checked : x)))
            }
          />
          {v}
        </label>
      ))}
    </div>
  );
  const qtyTable = (
    <div className="rt-table">
      <table>
        <thead>
          <tr>
            <th>植物</th>
            <th>数量 / 株</th>
            <th>单价</th>
            <th>小计</th>
          </tr>
        </thead>
        <tbody>
          {plants.map((p, i) => (
            <tr key={p.name}>
              <td>
                {p.name}
                <small>{p.latin}</small>
              </td>
              <td>
                <input
                  aria-label={p.name + "数量"}
                  type="number"
                  min={0}
                  max={30}
                  value={s.qty[i]}
                  onChange={(e) =>
                    change({
                      qty: s.qty.map((v, n) =>
                        n === i
                          ? Math.max(
                              0,
                              Math.min(30, Math.round(+e.target.value)),
                            )
                          : v,
                      ),
                    })
                  }
                />
              </td>
              <td>{money(p.price)}</td>
              <td>{money(p.price * s.qty[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const plan = (
    <div className="rt-plan" dangerouslySetInnerHTML={{ __html: planSVG(s) }} />
  );
  const execute = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
      msg("文件已生成；没有采购、发送或施工动作。");
    } catch {
      msg("导出失败，请检查素材读取后重试。");
    } finally {
      setBusy(false);
    }
  };
  let body: ReactNode;
  switch (s.page) {
    case 0:
      body = (
        <>
          <div className="rt-hero">
            {image("courtyard", "小庭院植物与石径")}
            <div>
              <small>ROOTS / GARDEN PLANNING STUDIO</small>
              <h1>
                一小块天地，
                <br />
                一整季生长。
              </h1>
              <p>
                从观察光与土开始，
                <br />
                为生活留出另一种节奏。
              </p>
              <button onClick={() => go(1)}>开始场地简报 ↗</button>
            </div>
          </div>
          <div className="rt-three">
            {stat("01 / OBSERVE", "先观察", "光照、土壤与场地边界。")}
            {stat("02 / PLAN", "再配置", "植物、土量、用水与预算。")}
            {stat("03 / GROW", "持续记录", "把计划变成可复核的日常。")}
          </div>
          <p>{pages[0][2]}</p>
        </>
      );
      break;
    case 1:
      body = (
        <div className="rt-two">
          <div>
            {text("花园项目名称", "project")}
            {text("使用目标与维护意愿", "brief", true)}
            {select(
              "气候演算背景",
              s.climate,
              ["温和参考 ×1", "偏热干燥 ×1.4", "偏凉湿润 ×0.75"],
              (climate) => change({ climate }),
            )}
          </div>
          <aside className="rt-paper">
            <h3>第一次现场观察</h3>
            <ol>
              <li>记录每天愿意投入多少维护时间。</li>
              <li>先找水源、排水口与不可移动设备。</li>
              <li>确认儿童、宠物与通行需求；物种安全要单独查证。</li>
              <li>不要在结构与防水未经确认时直接施工。</li>
            </ol>
          </aside>
        </div>
      );
      break;
    case 2:
      body = (
        <div className="rt-two">
          <div className="rt-measure-diagram">
            <span>{s.width} m</span>
            <div style={{ aspectRatio: `${s.width}/${s.depth}` }}>
              <b>{c.area} m²</b>
              <small>矩形净场地 / 示意</small>
            </div>
            <span>{s.depth} m</span>
          </div>
          <div>
            {num("场地宽度（m）", "width", 1, 12, 0.1)}
            {num("场地深度（m）", "depth", 1, 12, 0.1)}
            <p>
              缩小边界会同步夹紧种植床、通路与代表点；不代表障碍物和建筑边界已测绘。
            </p>
          </div>
        </div>
      );
      break;
    case 3:
      body = (
        <div className="rt-two">
          <div className="rt-sun">
            <i>☀</i>
            <strong>{s.sun} h</strong>
            <p>
              {["南向观察", "东向观察", "西向观察", "北向观察"][s.orientation]}
            </p>
          </div>
          <div>
            {num("观察到的直射日照（小时）", "sun", 0, 12, 0.5)}
            {select(
              "主要朝向",
              s.orientation,
              ["南", "东", "西", "北"],
              (orientation) => change({ orientation }),
            )}
            <p>
              建议分别在上午、中午和下午观察；跨季节阴影会变化。没有测光设备时不要把这个数值当作精确的植物光合数据。
            </p>
            <button onClick={() => go(8)}>查看已选植物的光照初筛 →</button>
          </div>
        </div>
      );
      break;
    case 4:
      body = (
        <div className="rt-two">
          {image("soil", "根团与土壤观察")}
          <div>
            {select("观察到的土质", s.soil, ["偏砂", "均衡", "偏黏"], (soil) =>
              change({ soil }),
            )}
            {select("排水观察", s.drain, ["较快", "中等", "较慢"], (drain) =>
              change({ drain }),
            )}
            {num("参考 pH 读数", "ph", 3, 10, 0.1)}
            <p className="rt-warning">
              {s.drain === 2
                ? "排水偏慢：采购植物前先查积水原因，不要只靠增加浇水频率管理。"
                : "先记录，后验证：本页不会生成改土用药处方。"}
            </p>
          </div>
        </div>
      );
      break;
    case 5:
      body = (
        <>
          {select(
            "植物光照筛选",
            s.filter,
            ["全部资料", "偏日照（最低≥5h）", "偏阴地（最低<5h）"],
            (filter) => change({ filter }),
          )}
          <div className="rt-cards">
            {plants
              .map((p, i) => ({ p, i }))
              .filter(
                ({ p }) =>
                  !s.filter ||
                  (s.filter === 1 ? p.light[0] >= 5 : p.light[0] < 5),
              )
              .map(({ p, i }) => (
                <article className="rt-card" key={p.name}>
                  <small>PLANT / 0{i + 1}</small>
                  <h3>{p.name}</h3>
                  <i>{p.latin}</i>
                  <p>{p.note}</p>
                  <div>
                    {p.light.join("–")} h 日照 · {p.spread} cm 冠幅
                  </div>
                  <button
                    onClick={() => {
                      patch({ selected: i, page: 6 });
                    }}
                  >
                    研究{p.name} →
                  </button>
                </article>
              ))}
          </div>
        </>
      );
      break;
    case 6:
      body = (
        <div className="rt-two">
          {image(s.selected < 2 ? "sun" : "shade", "香草或阴生植物环境示意")}
          <div>
            {select(
              "研究植物",
              s.selected,
              plants.map((p) => p.name),
              (selected) => change({ selected }),
            )}
            <h3>{plant.name}</h3>
            <i>{plant.latin}</i>
            <p>{plant.note}</p>
            <dl className="rt-spec">
              <dt>光照参考</dt>
              <dd>{plant.light.join("–")} h</dd>
              <dt>冠幅 / 高度</dt>
              <dd>
                {plant.spread} / {plant.height} cm
              </dd>
              <dt>周用水演算</dt>
              <dd>{plant.water} L / 株</dd>
              <dt>示例单价</dt>
              <dd>{money(plant.price)}</dd>
            </dl>
            <button
              onClick={() => {
                change({
                  qty: s.qty.map((v, i) =>
                    i === s.selected ? Math.min(30, v + 1) : v,
                  ),
                });
                msg("已加入种植清单；没有采购。");
              }}
            >
              加入一株
            </button>
            <p>图片仅示意生长环境，不是当前物种的鉴定照片或实际库存。</p>
          </div>
        </div>
      );
      break;
    case 7:
      body = (
        <>
          {qtyTable}
          <div className="rt-three">
            {stat(
              "总数",
              s.qty.reduce((a, b) => a + b, 0) + " 株",
              "每种最多 30 株。",
            )}
            {stat(
              "多样性",
              s.qty.filter(Boolean).length + " 种",
              "不是生态认证指标。",
            )}
            {stat(
              "植物预算",
              money(plants.reduce((a, p, i) => a + p.price * s.qty[i], 0)),
              "价格为示例。",
            )}
          </div>
        </>
      );
      break;
    case 8:
      body = (
        <>
          <div className="rt-cards">
            {plants.map(
              (p, i) =>
                s.qty[i] > 0 && (
                  <article
                    className={
                      "rt-card " + (c.compatible[i] ? "is-good" : "is-warning")
                    }
                    key={p.name}
                  >
                    <small>{c.compatible[i] ? "初筛匹配" : "需要复核"}</small>
                    <h3>{p.name}</h3>
                    <p>
                      参考 {p.light.join("–")} h / 当前观察 {s.sun} h
                    </p>
                    <p>{p.note}</p>
                    <button onClick={() => go(3)}>重新记录光照</button>
                  </article>
                ),
            )}
          </div>
          {!s.qty.some(Boolean) && <p>清单为空，请先添加植物。</p>}
        </>
      );
      break;
    case 9:
      body = (
        <>
          <div className="rt-two">
            {plan}
            <div>
              {select(
                "代表位置所属植物",
                s.selected,
                plants.map((p) => p.name),
                (selected) => change({ selected }),
              )}
              <label className="rt-field">
                水平坐标（cm）
                <input
                  type="range"
                  min={20}
                  max={s.width * 100 - 20}
                  value={s.positions[s.selected][0]}
                  onChange={(e) =>
                    change({
                      positions: s.positions.map((v, i) =>
                        i === s.selected ? [+e.target.value, v[1]] : v,
                      ),
                    })
                  }
                />
                {s.positions[s.selected][0]} cm
              </label>
              <label className="rt-field">
                垂直坐标（cm）
                <input
                  type="range"
                  min={20}
                  max={s.depth * 100 - 20}
                  value={s.positions[s.selected][1]}
                  onChange={(e) =>
                    change({
                      positions: s.positions.map((v, i) =>
                        i === s.selected ? [v[0], +e.target.value] : v,
                      ),
                    })
                  }
                />
                {s.positions[s.selected][1]} cm
              </label>
              <p>
                每个符号代表一个品种的位置意向，不是所有植株的精确布点；未选品种不会显示。
              </p>
              <button
                onClick={() =>
                  change({ positions: structuredClone(initial.positions) })
                }
              >
                重置代表点
              </button>
            </div>
          </div>
          <p className="rt-warning">
            {overlaps(s).length
              ? "示意冠幅重叠：" + overlaps(s).join("；")
              : "当前代表点未检出冠幅重叠；不代表真实种植间距已通过复核。"}
          </p>
        </>
      );
      break;
    case 10:
      body = (
        <>
          <div className="rt-two">
            {plan}
            <div>
              {num("种植床宽（m）", "bedW", 0.2, s.width, 0.1)}
              {num("种植床深（m）", "bedD", 0.2, s.depth, 0.1)}
              {num("有效基质深（cm）", "bedH", 10, 60, 1)}
            </div>
          </div>
          {stat(
            "BED VOLUME",
            c.bed + " L",
            "长 × 宽 × 深，未包含结构板材与排水层。",
          )}
        </>
      );
      break;
    case 11:
      body = (
        <div className="rt-two">
          <div className="rt-pot">
            <svg viewBox="0 0 320 320" aria-label="容器容量示意" role="img">
              <ellipse cx="160" cy="70" rx="95" ry="27" fill="#8b6f4f" />
              <path
                d="M65 70L95 260Q160 295 225 260L255 70Q160 115 65 70"
                fill="#b78968"
              />
              <ellipse cx="160" cy="70" rx="82" ry="20" fill="#534c3e" />
              <text x="160" y="190" textAnchor="middle" fill="white">
                ≈ {c.pot} L / 盆
              </text>
            </svg>
            <p>外观示意有锥度；容量按圆柱体近似，实际应以厂家资料为准。</p>
          </div>
          <div>
            {num("容器内径（cm）", "potD", 15, 80)}
            {num("容器有效高度（cm）", "potH", 15, 80)}
            {num("容器数量", "pots", 0, 20)}
            {num("顶部留空（%）", "headroom", 0, 30)}
          </div>
        </div>
      );
      break;
    case 12:
      body = (
        <>
          <div className="rt-three">
            {stat(
              "TOTAL",
              c.litres + " L",
              "种植床 " +
                c.bed +
                " L + 容器 " +
                (c.pot * s.pots).toFixed(2) +
                " L",
            )}
            {stat(
              "PURCHASE",
              c.bags + " 袋",
              "总容积 ÷ " + s.bag + " L，向上取整。",
            )}
            {stat(
              "WEIGHT",
              c.weight + " kg",
              "仅基质湿重估算；不包含人、容器与结构。",
            )}
          </div>
          <div className="rt-three">
            {num("每袋容量（L）", "bag", 5, 100)}
            {num("改良部分（%）", "mix", 0, 50)}
            {num("参考湿密度（kg/L）", "density", 0.1, 2, 0.1)}
          </div>
          <p>
            基质主料约 {(c.litres * (1 - s.mix / 100)).toFixed(1)} L，改良部分约{" "}
            {((c.litres * s.mix) / 100).toFixed(1)}{" "}
            L。具体配方需结合植物和真实材料。
          </p>
          <p className="rt-warning">
            这不是承重验算；在阳台或屋顶使用前必须获得专业确认。
          </p>
        </>
      );
      break;
    case 13:
      body = (
        <>
          <div className="rt-three">
            {stat(
              "WEEKLY ESTIMATE",
              c.water + " L",
              "数量 × 参考周水量 × 气候系数",
            )}
            {stat("RAIN RESERVE", c.rain + " L", "按当前雨量情景与桶容量估算")}
            {stat("TOP-UP", c.topup + " L", "不足部分的算术差额，不是浇水命令")}
          </div>
          <div className="rt-table">
            <table>
              <thead>
                <tr>
                  <th>植物</th>
                  <th>数量</th>
                  <th>参考周水量 / 株</th>
                </tr>
              </thead>
              <tbody>
                {plants.map(
                  (p, i) =>
                    s.qty[i] > 0 && (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td>{s.qty[i]}</td>
                        <td>{p.water} L</td>
                      </tr>
                    ),
                )}
              </tbody>
            </table>
          </div>
          <button onClick={() => go(1)}>调整气候演算背景</button>
        </>
      );
      break;
    case 14:
      body = (
        <div className="rt-two">
          <div className="rt-rain">
            <span>☁</span>
            <strong>{c.rain} L</strong>
            <progress max={Math.max(1, s.tank)} value={c.rain} />
            <p>
              收集效率 {s.efficiency}% · 桶容量 {s.tank} L
            </p>
          </div>
          <div>
            {num("集水面（m²）", "catchment", 0, 100, 0.5)}
            {num("情景降雨（mm）", "rain", 0, 150)}
            {num("收集效率（%）", "efficiency", 0, 100)}
            {num("储水桶容量（L）", "tank", 0, 500)}
          </div>
        </div>
      );
      break;
    case 15:
      body = (
        <>
          <div className="rt-two">
            {[0, 1].map((group) => (
              <article className="rt-paper" key={group}>
                <small>ZONE / 0{group + 1}</small>
                <h3>{group ? "偏湿润观察组" : "偏干燥观察组"}</h3>
                {plants.map(
                  (p, i) =>
                    p.group === group &&
                    s.qty[i] > 0 && (
                      <p key={p.name}>
                        {p.name} × {s.qty[i]} · {s.qty[i] * s.emitters} 个滴头
                      </p>
                    ),
                )}
                <p>分组仅为管理线索，不能替代现场压力与水分设计。</p>
              </article>
            ))}
          </div>
          <div className="rt-three">
            {num("软管长度（m）", "hose", 0, 100)}
            {num("每株滴头数", "emitters", 1, 5)}
            {stat("DRIPPERS", c.heads + " 个", "没有设备连接或自动灌溉。")}
          </div>
        </>
      );
      break;
    case 16:
      body = (
        <>
          <div className="rt-two">
            {plan}
            <div>
              {num("步道宽（m）", "pathW", 0.3, Math.min(3, s.width), 0.1)}
              {num("步道长（m）", "pathL", 0.3, s.depth, 0.1)}
              {num("铺装损耗（%）", "waste", 0, 30)}
              <h3>{c.tiles} 块 / 30 × 30 cm</h3>
              <p>
                步道面积 {(s.pathW * s.pathL).toFixed(2)}{" "}
                m²；未扣除接缝，砖数向上取整。示意位置靠场地右侧，可能与植物重叠，应在平面中自行复核。
              </p>
            </div>
          </div>
        </>
      );
      break;
    case 17:
      body = (
        <div className="rt-two">
          {image("shade", "阴生植物层次")}
          <div>
            {check(
              ["记录访花昆虫", "留出枯枝观察角落", "考虑安全浅水点"],
              s.eco,
              (eco) => change({ eco }),
            )}
            <h3>示例花期覆盖</h3>
            <div className="rt-months">
              {Array.from({ length: 12 }, (_, i) => (
                <span
                  className={
                    plants.some(
                      (p, j) =>
                        s.qty[j] &&
                        (p.months as readonly number[]).includes(i + 1),
                    )
                      ? "active"
                      : ""
                  }
                  key={i}
                >
                  {i + 1}月
                </span>
              ))}
            </div>
            <p>高亮表示清单中至少一个物种的参考花期，不是当地实际开花预测。</p>
          </div>
        </div>
      );
      break;
    case 18:
      body = (
        <>
          {select(
            "养护月份",
            s.month,
            Array.from({ length: 12 }, (_, i) => i + 1 + "月"),
            (month) => change({ month }),
          )}
          <div className="rt-cards">
            {plants.map(
              (p, i) =>
                s.qty[i] > 0 && (
                  <article className="rt-card" key={p.name}>
                    <small>
                      {s.month + 1} MONTH / {s.qty[i]}株
                    </small>
                    <h3>{p.name}</h3>
                    <p>
                      {(p.months as readonly number[]).includes(s.month + 1)
                        ? "处于参考花期：观察花序和访花昆虫，避免在访花活跃时随意干预。"
                        : "不在示例花期：重点观察叶片、基质与通风，修剪需结合实际物种。"}
                    </p>
                    <p>{p.note}</p>
                  </article>
                ),
            )}
          </div>
        </>
      );
      break;
    case 19:
      body = (
        <div className="rt-two">
          <div>
            {check(
              [
                "检查基质干湿",
                "检查排水出口",
                "观察叶片与虫害线索",
                "保持通路畅通",
              ],
              s.checks,
              (checks) => change({ checks }),
            )}
            {text("本次养护观察", "notes", true)}
            <button
              onClick={() => {
                if (s.notes.trim().length < 6) {
                  msg("请至少写 6 个字符记录观察。");
                  return;
                }
                change({
                  logs: [
                    {
                      date: new Date().toISOString(),
                      notes: s.notes.trim(),
                      checks: [...s.checks],
                    },
                    ...s.logs,
                  ].slice(0, 8),
                });
                msg("已保存独立养护记录，没有诊断或用药动作。");
              }}
            >
              保存养护记录
            </button>
          </div>
          <aside>
            {image("tools", "园艺工作台")}
            <h3>最近八次观察</h3>
            {s.logs.map((l, i) => (
              <article className="rt-card" key={l.date + i}>
                <small>
                  {l.date.slice(0, 10)} · 检查 {l.checks.filter(Boolean).length}
                  /4
                </small>
                <p>{l.notes}</p>
              </article>
            ))}
            {!s.logs.length && (
              <p>
                暂无记录。先写事实，再讨论原因，例如：昨晚雨后盆底仍积水，需要检查排水孔。
              </p>
            )}
          </aside>
        </div>
      );
      break;
    case 20:
      body = (
        <>
          <div className="rt-three">
            {num("项目预算（元）", "budget", 0, 100000, 100)}
            {num("示例税率（%）", "tax", 0, 20)}
            {stat(
              "BALANCE",
              money(s.budget - c.total),
              s.budget < c.total
                ? "当前估算超过预算。"
                : "仅材料预算差额，不包含劳务。",
            )}
          </div>
          <div className="rt-table">
            <table>
              <thead>
                <tr>
                  <th>材料</th>
                  <th>数量</th>
                  <th>单价</th>
                  <th>小计</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.qty}</td>
                    <td>{money(r.price)}</td>
                    <td>{money(r.qty * r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rt-total">
            税费 {money(c.tax)}
            <strong data-testid="roots-total">{money(c.total)}</strong>
          </div>
          <button onClick={() => csvExport(s)}>导出预算 CSV</button>
        </>
      );
      break;
    case 21:
      body = (
        <ol className="rt-phases">
          {phases.map((v, i) => (
            <li key={v}>
              <span>{i + 1}</span>
              <div>
                <h3>{v}</h3>
                <p>
                  {
                    [
                      "先核对边界、障碍与水源。",
                      "不得用本模板替代工程确认。",
                      "检查实物规格、数量与状态。",
                      "代表点需要进一步细化为实际布点。",
                      "重新检查间距、通行和积水风险。",
                      "交付清单、养护要求与复查时间。",
                    ][i]
                  }
                </p>
              </div>
              <button
                disabled={s.phase !== i}
                onClick={() => change({ phase: i + 1 })}
              >
                {s.phase > i ? "已手动复核" : "完成复核"}
              </button>
            </li>
          ))}
        </ol>
      );
      break;
    case 22:
      body = (
        <div className="rt-two">
          <div>
            {text("评审人称呼", "reviewer")}
            <p>
              当前 {c.area} m² / {s.qty.reduce((a, b) => a + b, 0)} 株 /{" "}
              {money(c.total)}
            </p>
            <button
              disabled={!s.reviewer.trim() || !s.qty.some(Boolean)}
              onClick={() => {
                if (s.review && !confirm("替换本地评审快照？请先导出旧方案。"))
                  return;
                change({
                  review: {
                    at: new Date().toISOString(),
                    name: s.reviewer,
                    total: c.total,
                    area: c.area,
                    water: c.water,
                    selection: plants
                      .map((p, i) => (s.qty[i] ? `${p.name}×${s.qty[i]}` : ""))
                      .filter(Boolean)
                      .join("、"),
                    status: "confirmed",
                  },
                });
                msg("本地评审快照已创建；不是采购或施工确认。");
              }}
            >
              确认本地方案快照
            </button>
            <p>
              需要评审人称呼与至少一株植物。这里没有身份签名或专业资格核验。
            </p>
          </div>
          <aside className="rt-paper">
            {s.review ? (
              <>
                <small>FROZEN REVIEW / {s.review.at.slice(0, 10)}</small>
                <h3>{s.review.name}</h3>
                <p>{s.review.selection}</p>
                <strong>{money(s.review.total)}</strong>
                <p>
                  {s.review.area} m² ·{" "}
                  {s.review.status === "confirmed" ? "本地已确认" : "已撤回"}
                </p>
                <button
                  disabled={s.review.status === "withdrawn"}
                  onClick={() => {
                    if (confirm("撤回本地评审状态？"))
                      change({ review: { ...s.review!, status: "withdrawn" } });
                  }}
                >
                  撤回评审
                </button>
              </>
            ) : (
              <>
                <h3>让讨论有一个共同版本。</h3>
                <p>
                  尚未创建快照。此处将保留确认时的面积、植物清单、周水量和估算总额，避免后续草稿改动混淆讨论。
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
          <div className="rt-delivery">
            <h3>{s.project}</h3>
            <p>
              {c.area} m² · {s.qty.filter(Boolean).length} 类植物 ·{" "}
              {money(c.total)}
            </p>
            <div>
              <button onClick={() => jsonExport(s)}>导出项目 JSON</button>
              <button onClick={() => csvExport(s)}>导出预算 CSV</button>
              <button
                disabled={busy}
                onClick={() => void execute(() => svgExport(s))}
              >
                下载平面 SVG
              </button>
              <button
                disabled={busy}
                onClick={() => void execute(() => htmlExport(s))}
              >
                {busy ? "打包中…" : "导出离线方案 HTML"}
              </button>
            </div>
          </div>
          <label className="rt-field">
            恢复项目 JSON
            <input
              type="file"
              accept=".json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  if (f.size > 500000) throw Error("文件不能超过500KB。");
                  const v = JSON.parse(await f.text());
                  if (
                    v.format !== "roots-project-v1" ||
                    typeof v.state?.project !== "string"
                  )
                    throw Error("不是 ROOTS 项目文件。");
                  if (confirm("替换当前草稿？")) patch(restore(v.state));
                } catch (e) {
                  msg(e instanceof Error ? e.message : "导入失败。");
                }
              }}
            />
          </label>
          <p>
            五张专用 AI 概念图与中文字体会内嵌进 HTML。项目 JSON
            不包含命名版本历史；服务器保存为显式快照。没有天气服务、实时植物库存、施工订单或付款功能。
          </p>
        </>
      );
  }
  return (
    <main className="roots-work">
      <SampleTop
        type="原型 / 24 个规划页面"
        title="ROOTS · 植物与花园规划"
        draftId={draftId}
        onCopy={() => {
          try {
            copySample("roots", s);
          } catch {
            msg("副本保存失败，请先导出。");
          }
        }}
      >
        <button onClick={() => go(23)}>交付方案</button>
      </SampleTop>
      <Notice text={error || notice} />
      {controls}
      <div className="rt-shell">
        <header className="rt-brand">
          <b>
            ROOTS<span>GARDEN PLANNING STUDIO</span>
          </b>
          <div>
            <small>你的花园 / PLAN IN PROGRESS</small>
            <strong>{s.project}</strong>
          </div>
          <span>
            {c.area} m²
            <br />
            {s.qty.reduce((a, b) => a + b, 0)} 株
          </span>
        </header>
        <div className="rt-workspace">
          <nav aria-label="ROOTS 页面目录">
            {pages.map((p, i) => (
              <button
                key={p[0]}
                title={p[0]}
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
            className={"rt-page rt-page-" + s.page}
            aria-label={pages[s.page][0]}
            data-page={s.page}
          >
            {s.page > 0 && (
              <header className="rt-heading">
                <small>
                  FIELD NOTES / {String(s.page + 1).padStart(2, "0")} —{" "}
                  {pages[s.page][0]}
                </small>
                <h1>{pages[s.page][1]}</h1>
                <p>{pages[s.page][2]}</p>
              </header>
            )}
            {body}
            <footer>
              <span>{s.page + 1} / 24 · 方案演算，非施工或采购</span>
              <div>
                <button disabled={!s.page} onClick={() => go(s.page - 1)}>
                  上一页
                </button>
                <button disabled={s.page === 23} onClick={() => go(s.page + 1)}>
                  下一页 →
                </button>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}
