import { useRef, useState, type ReactNode } from "react";
import {
  SampleTop,
  Notice,
  copySample,
  useSampleState,
  download,
} from "../shared";
import {
  pages,
  initial,
  restore,
  quote,
  money,
  colors,
  fabrics,
  silhouettes,
  measurements,
  summary,
  schedule,
  stages,
  stageNotes,
  problems,
  clamp,
  dateValid,
  type State,
} from "./model";
import { images } from "./images";
import {
  technical,
  board,
  exportJSON,
  exportCSV,
  exportSVG,
  exportHTML,
  alterationText,
} from "./delivery";
import "./atelier.css";
type Version = { name: string; state: State };
const fitLabels = [
  "领口贴合，无明显离颈",
  "肩部平顺，抬手可活动",
  "袖长符合穿着习惯",
  "腰部站坐均舒适",
  "裤脚长度与鞋型协调",
];
export default function AtelierPrototype({ draftId }: { draftId?: string }) {
  const [s, set, error] = useSampleState("atelier", draftId, initial),
    [notice, msg] = useState(""),
    [busy, setBusy] = useState(false),
    [versionName, setVersionName] = useState(""),
    [piece, setPiece] = useState(0);
  const undo = useRef<State[]>([]),
    redo = useRef<State[]>([]);
  const versionKey = "designbuddy.atelier.versions." + (draftId || "sample");
  const [versions, setVersions] = useState<Version[]>(() => {
    try {
      const raw = localStorage.getItem(versionKey);
      if (!raw || raw.length > 500000) return [];
      const a = JSON.parse(raw);
      return Array.isArray(a)
        ? a
            .filter(
              (x) =>
                x &&
                typeof x.name === "string" &&
                x.state &&
                typeof x.state === "object",
            )
            .slice(0, 6)
            .map((x) => ({
              name: x.name.slice(0, 40),
              state: restore(x.state),
            }))
        : [];
    } catch {
      return [];
    }
  });
  const change = (patch: Partial<State>, record = true) => {
    if (record) {
      undo.current = [...undo.current, s].slice(-40);
      redo.current = [];
    }
    set({ ...s, ...patch });
    msg("");
  };
  const go = (page: number) => change({ page }, false);
  const q = quote(s),
    dates = schedule(s),
    issues = problems(s);
  const image = (key: keyof typeof images, alt: string) => (
    <img
      className="at-photo"
      src={images[key]}
      alt={alt + "（AI 概念图）"}
      loading="lazy"
    />
  );
  const text = (
    label: string,
    key:
      | "project"
      | "brief"
      | "boardNotes"
      | "client"
      | "contact"
      | "monogram"
      | "fitNotes"
      | "alteration",
    multi = false,
  ) => (
    <label className="at-field">
      {label}
      {multi ? (
        <textarea
          value={s[key]}
          maxLength={2000}
          onChange={(e) => change({ [key]: e.target.value })}
        />
      ) : (
        <input
          value={s[key]}
          maxLength={key === "monogram" ? 12 : key === "contact" ? 120 : 80}
          onChange={(e) => change({ [key]: e.target.value })}
        />
      )}
    </label>
  );
  const choose = (
    label: string,
    value: number,
    options: readonly string[],
    onChange: (n: number) => void,
  ) => (
    <fieldset className="at-choice">
      <legend>{label}</legend>
      <div>
        {options.map((name, i) => (
          <button
            key={name}
            aria-pressed={i === value}
            onClick={() => onChange(i)}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  );
  const range = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (n: number) => void,
  ) => (
    <label className="at-range">
      <span>
        {label}
        <b>{value}</b>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
  const checks = (
    labels: string[],
    values: boolean[],
    setValues: (next: boolean[]) => void,
  ) => (
    <div className="at-checks">
      {labels.map((label, i) => (
        <label key={label}>
          <input
            type="checkbox"
            checked={values[i]}
            onChange={(e) =>
              setValues(values.map((v, n) => (n === i ? e.target.checked : v)))
            }
          />
          {label}
        </label>
      ))}
    </div>
  );
  const technicalView = (
    <div
      className="at-technical"
      dangerouslySetInnerHTML={{ __html: technical(s) }}
    />
  );
  const quoteTable = (
    <div className="at-table">
      <table>
        <thead>
          <tr>
            <th>制作项目</th>
            <th>单件金额</th>
            <th>{s.quantity} 件小计</th>
          </tr>
        </thead>
        <tbody>
          {q.lines.map((l) => (
            <tr key={l.label}>
              <td>{l.label}</td>
              <td>{money(l.amount)}</td>
              <td>{money(l.amount * s.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="at-totals">
        <dt>折扣 {s.discount}%</dt>
        <dd>−{money(q.discount)}</dd>
        <dt>税费 {s.tax}%</dt>
        <dd>{money(q.tax)}</dd>
        <dt>方案总额</dt>
        <dd data-testid="atelier-total">{money(q.total)}</dd>
      </dl>
    </div>
  );
  const runExport = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
      msg("导出文件已生成；没有发送给任何服务方。");
    } catch {
      msg("导出失败，请检查素材加载后重试。");
    } finally {
      setBusy(false);
    }
  };
  const saveVersion = () => {
    if (!versionName.trim()) {
      msg("请先填写版本名称。");
      return;
    }
    const next = [
      { name: versionName.trim().slice(0, 40), state: structuredClone(s) },
      ...versions,
    ].slice(0, 6);
    try {
      localStorage.setItem(versionKey, JSON.stringify(next));
      setVersions(next);
      setVersionName("");
      msg("命名版本已保存到本机。");
    } catch {
      msg("版本保存失败，请导出 JSON 备份。");
    }
  };
  let content: ReactNode;
  switch (s.page) {
    case 0:
      content = (
        <>
          <section className="at-hero">
            <div>
              <small>THE PERSONAL EDITION / 2026</small>
              <h1>
                为你，
                <br />
                而非尺码。
              </h1>
              <p>
                不必适应衣服。
                <br />
                让衣服，理解你。
              </p>
              <button className="at-primary" onClick={() => go(1)}>
                开启订制简报 ↗
              </button>
              <span>01 / A WARDROBE WITH INTENTION</span>
            </div>
            {image("campaign", "黑色订制服饰与酒红布景")}
          </section>
          <div className="at-editorial">
            <h2>
              一件衣服的
              <br />
              二十四种思考。
            </h2>
            <p>{pages[0][2]}</p>
          </div>
          <div className="at-stats">
            <span>
              <b>01</b>从穿着需求开始
            </span>
            <span>
              <b>08</b>量体维度独立记录
            </span>
            <span>
              <b>24</b>页面组成完整方案
            </span>
          </div>
          <button className="at-banner" onClick={() => go(13)}>
            看见藏在衣服里的工艺 <span>THE INVISIBLE CRAFT ↗</span>
          </button>
        </>
      );
      break;
    case 1:
      content = (
        <div className="at-two">
          <div>
            {text("项目名称", "project")}
            {text("穿着需求与风格简报", "brief", true)}
            {choose(
              "主要穿着场合",
              s.occasion,
              ["日常通勤", "正式聚会", "旅行"],
              (occasion) => change({ occasion }),
            )}
            <button onClick={() => go(2)}>进入廓形研究 →</button>
          </div>
          <aside className="at-note">
            <small>BRIEF / BEFORE DESIGN</small>
            <h3>
              {
                [
                  "从早到晚，都自然。",
                  "重要场合，也像自己。",
                  "轻装，不牺牲风格。",
                ][s.occasion]
              }
            </h3>
            <ul>
              {[
                "穿着时是否需要久坐或频繁抬手？",
                "内搭的厚度与习惯是什么？",
                "更看重线条、活动量还是耐打理？",
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p>以上回答不会被提交或用于商业画像；它们是本地方案的沟通起点。</p>
          </aside>
        </div>
      );
      break;
    case 2:
      content = (
        <>
          <div className="at-three">
            {silhouettes.map((shape, i) => (
              <article
                className={s.silhouette === i ? "at-card selected" : "at-card"}
                key={shape.name}
              >
                <svg
                  viewBox="0 0 160 200"
                  role="img"
                  aria-label={shape.name + "轮廓"}
                >
                  <path
                    d={`M${i === 2 ? 35 : 45} 35L65 20H95L${i === 2 ? 125 : 115} 35L145 110L125 120L110 75L${i === 1 ? 101 : 113} 170H${i === 1 ? 59 : 47}L50 75L35 120L15 110Z`}
                    fill={i === 1 ? "#9b3845" : "#d1c7b7"}
                  />
                  <path d="M65 20L80 90L95 20" stroke="#171717" fill="none" />
                </svg>
                <h3>{shape.name}</h3>
                <p>{shape.note}</p>
                <b>{money(shape.base)} 起 / 示例</b>
                <button
                  aria-pressed={s.silhouette === i}
                  onClick={() => change({ silhouette: i })}
                >
                  选择{shape.name.split(" / ")[0]}廓形
                </button>
              </article>
            ))}
          </div>
          <p className="at-disclosure">
            三种方向共用你的量体记录；选择不代表该版型已经完成专业打版。
          </p>
        </>
      );
      break;
    case 3:
      content = (
        <>
          <div className="at-material-hero">
            {image("textile", "酒红人字纹毛料")}
            <div>
              <small>TEXTILE / STUDY 001</small>
              <h3>
                从一根纤维，
                <br />
                到一种触感。
              </h3>
              <label>
                面料季节
                <select
                  value={s.season}
                  onChange={(e) => change({ season: e.target.value }, false)}
                >
                  {["全部", "四季", "春夏", "秋冬"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="at-three">
            {fabrics
              .map((f, i) => ({ f, i }))
              .filter(({ f }) => s.season === "全部" || f.season === s.season)
              .map(({ f, i }) => (
                <article className="at-card" key={f.name}>
                  <small>
                    {f.season} / {f.weight} g/m²
                  </small>
                  <h3>{f.name}</h3>
                  <p>{f.composition}</p>
                  <p>{f.care}</p>
                  <b>增项 {money(f.cost)}</b>
                  <button
                    aria-pressed={s.fabric === i}
                    onClick={() => change({ fabric: i })}
                  >
                    选用{f.name}
                  </button>
                </article>
              ))}
          </div>
        </>
      );
      break;
    case 4:
      content = (
        <div className="at-two">
          <div>{technicalView}</div>
          <div>
            <div className="at-swatches">
              {colors.map(([name, color], i) => (
                <button
                  key={name}
                  aria-pressed={s.color === i}
                  onClick={() => change({ color: i })}
                >
                  <i style={{ background: color }} />
                  {name}
                  <small>{color}</small>
                </button>
              ))}
            </div>
            <h3>当前色彩 / {colors[s.color][0]}</h3>
            <p>
              颜色作用于技术图与搭配符号，不会伪造照片中的材质。实物色差应通过色卡确认。
            </p>
          </div>
        </div>
      );
      break;
    case 5:
      content = (
        <div className="at-two">
          {technicalView}
          <div>
            {choose(
              "驳领形式",
              s.lapel,
              ["平驳领", "戗驳领", "青果领"],
              (lapel) => change({ lapel }),
            )}
            {choose(
              "后背开衩",
              s.vent,
              ["双开衩", "单开衩", "无开衩"],
              (vent) => change({ vent }),
            )}
            {choose("口袋形式", s.pocket, ["翻盖袋", "贴袋"], (pocket) =>
              change({ pocket }),
            )}
            <p>
              技术图显示正面驳领与口袋；后背开衩记录在规格中，不在正面图中假装可见。
            </p>
          </div>
        </div>
      );
      break;
    case 6:
      content = (
        <div className="at-two">
          <svg
            viewBox="0 0 360 450"
            className="at-trousers"
            role="img"
            aria-label="下装结构示意"
          >
            <rect width="360" height="450" fill="#e6e1d6" />
            <path
              d="M100 45H260L275 380H205L180 150L155 380H85Z"
              fill={colors[s.color][1]}
            />
            <path d="M100 65H260M180 45V150" stroke="#d8cfbd" />
            {s.pleat > 0 && (
              <path d="M130 65L125 210M230 65L235 210" stroke="#d8cfbd" />
            )}
            {s.pleat === 2 && (
              <path d="M145 65L145 180M215 65L215 180" stroke="#d8cfbd" />
            )}
            {s.hem === 1 && (
              <path
                d="M85 358H157M203 358H274"
                stroke="#d8cfbd"
                strokeWidth="8"
              />
            )}
            <text x="180" y="420" textAnchor="middle" fill="#242424">
              裤内长 {s.measures.inseam} cm · 仅示意
            </text>
          </svg>
          <div>
            {choose("前片裤褶", s.pleat, ["无褶", "单褶", "双褶"], (pleat) =>
              change({ pleat }),
            )}
            {choose(
              "腰部结构",
              s.waistband,
              ["腰袢", "侧调节扣"],
              (waistband) => change({ waistband }),
            )}
            {choose("裤脚收口", s.hem, ["平脚", "翻边"], (hem) =>
              change({ hem }),
            )}
            <p>
              图示展示裤褶与翻边；腰部扣件作为工艺记录。裤脚实际长度需配合常穿鞋复核。
            </p>
          </div>
        </div>
      );
      break;
    case 7:
      content = (
        <div className="at-two">
          <div className="at-lining">
            <small>PRIVATE DETAILS</small>
            <span>{s.monogram || "YOUR INITIALS"}</span>
            <p>
              {
                [
                  "全里 · 覆盖躯干与袖部",
                  "半里 · 减少背部覆盖",
                  "无里 · 需额外复核内侧收边",
                ][s.lining]
              }
            </p>
          </div>
          <div>
            {choose("内里结构", s.lining, ["全里", "半里", "无里"], (lining) =>
              change({ lining }),
            )}
            {text("绣字内容（最多 12 字符）", "monogram")}
            <p>
              绣字预计增项 {money(s.monogram.trim() ? 120 : 0)}
              。显示文字不是刺绣仿真，最终位置与字形需样片确认。
            </p>
          </div>
        </div>
      );
      break;
    case 8:
      content = (
        <div className="at-two">
          <svg
            className="at-human"
            viewBox="0 0 360 460"
            role="img"
            aria-label="人体量体位置示意"
          >
            <rect width="360" height="460" fill="#d8cdbb" />
            <g fill="none" stroke="#383332" strokeWidth="3">
              <circle cx="180" cy="55" r="28" />
              <path d="M160 85L125 100L100 240M200 85L235 100L260 240M125 100L135 260L125 415M235 100L225 260L235 415M180 270V420M135 260Q180 280 225 260" />
            </g>
            <path
              d={
                [
                  "M125 140H235",
                  "M135 190H225",
                  "M135 260H225",
                  "M125 100H235",
                  "M235 100L260 240",
                  "M180 85V300",
                  "M190 280V415",
                  "M80 28V420",
                ][s.guide]
              }
              stroke="#9d2337"
              strokeWidth="6"
            />
            <text x="180" y="445" textAnchor="middle" fill="#3b292e">
              {measurements[s.guide].label} / 非专业量体替代
            </text>
          </svg>
          <div>
            {choose(
              "查看量体部位",
              s.guide,
              measurements.map((m) => m.label),
              (guide) => change({ guide }, false),
            )}
            <h3>{measurements[s.guide].label}</h3>
            <p>{measurements[s.guide].guide}</p>
            <p>
              连续量两次，若差异超过 1
              cm，请检查尺带位置后重测。不要为了匹配某个尺寸标签而收紧身体。
            </p>
            <button onClick={() => go(9)}>填写量体记录 →</button>
          </div>
        </div>
      );
      break;
    case 9:
      content = (
        <>
          <div className="at-measures">
            {measurements.map((m) => (
              <label className="at-field" key={m.key}>
                {m.label}（cm）
                <input
                  type="number"
                  min={0}
                  max={300}
                  step="0.5"
                  aria-label={`${m.label}（cm）`}
                  value={s.measures[m.key]}
                  onChange={(e) =>
                    change({
                      measures: {
                        ...s.measures,
                        [m.key]: clamp(+e.target.value, 0, 300),
                      },
                      verified: false,
                    })
                  }
                />
                <small>
                  {m.min}–{m.max} cm · {m.guide}
                </small>
                {(s.measures[m.key] < m.min || s.measures[m.key] > m.max) && (
                  <em>请复核这个数值</em>
                )}
              </label>
            ))}
          </div>
          {checks(
            ["我已核对本人量体数据，初始示例不能用于实际制作"],
            [s.verified],
            (v) => change({ verified: v[0] }),
          )}
          <p className="at-disclosure">
            本页做范围检查，不推断性别、健康或体型，也不保证定制合体。
          </p>
        </>
      );
      break;
    case 10:
      content = (
        <>
          <div className="at-three">
            {(["chest", "waist", "hip"] as const).map((key, i) => (
              <article className="at-card at-ease" key={key}>
                <small>{["CHEST", "WAIST", "HIP"][i]}</small>
                <h3>{["胸", "腰", "臀"][i]}部松量</h3>
                <strong>
                  {s.measures[key] + s.ease[i]}
                  <small> cm</small>
                </strong>
                <p>
                  净体 {s.measures[key]} + 松量 {s.ease[i]}
                </p>
                {range(
                  ["胸部松量", "腰部松量", "臀部松量"][i],
                  s.ease[i],
                  0,
                  24,
                  (n) =>
                    change({
                      ease: s.ease.map((v, j) =>
                        j === i ? n : v,
                      ) as State["ease"],
                    }),
                )}
              </article>
            ))}
          </div>
          <button onClick={() => change({ ease: [10, 8, 6] })}>
            恢复参考松量 10 / 8 / 6
          </button>
          <p>这只是围度相加，不是成衣打版算法；不同面料和层次需要专业复核。</p>
        </>
      );
      break;
    case 11:
      content = (
        <div className="at-two">
          {technicalView}
          <div>
            <h3>{s.project}</h3>
            <p>{summary(s)}</p>
            <dl className="at-specs">
              {measurements.map((m) => (
                <div key={m.key}>
                  <dt>{m.label}</dt>
                  <dd>{s.measures[m.key]} cm</dd>
                </div>
              ))}
            </dl>
            <button
              disabled={busy}
              onClick={() => void runExport(() => exportSVG(s))}
            >
              下载技术 SVG
            </button>
            <p>嵌入中文字体与许可，支持离线查看；图形不是可裁剪纸样。</p>
          </div>
        </div>
      );
      break;
    case 12:
      content = (
        <div className="at-two">
          <div
            className="at-board"
            dangerouslySetInnerHTML={{ __html: board(s) }}
          />
          <div>
            {choose("调整搭配元素", piece, ["上装", "内搭", "腰带"], setPiece)}
            {range("水平位置", s.board[piece][0], 0, 400, (n) =>
              change({
                board: s.board.map((v, i) => (i === piece ? [n, v[1]] : v)),
              }),
            )}
            {range("垂直位置", s.board[piece][1], 0, 400, (n) =>
              change({
                board: s.board.map((v, i) => (i === piece ? [v[0], n] : v)),
              }),
            )}
            {text("搭配说明", "boardNotes", true)}
            <button
              onClick={() => change({ board: structuredClone(initial.board) })}
            >
              重置搭配布局
            </button>
          </div>
        </div>
      );
      break;
    case 13:
      content = (
        <>
          <div className="at-two">
            {image("workshop", "手工疏缝与制作工具")}
            <div>
              {choose(
                "胸衬结构",
                s.construction,
                ["半麻衬", "全麻衬"],
                (construction) => change({ construction }),
              )}
              {checks(["加入手工挑缝（示例增项 ¥260）"], [s.handwork], (v) =>
                change({ handwork: v[0] }),
              )}
              <h3>
                {s.construction
                  ? "耐心，藏在整个前身。"
                  : "把结构，放在需要的地方。"}
              </h3>
              <p>
                {s.construction
                  ? "全麻衬增加前身结构层的制作工时，本方案增加 7 个日历天。实际选择仍需结合面料、用途和预算。"
                  : "半麻衬方案保留上胸与驳领的结构意图，并以较短工时作为演示基准。它不是一个品质高低的简单标签。"}
              </p>
            </div>
          </div>
          <div className="at-three">
            {[
              "肩部支撑：检查线条与抬手活动。",
              "驳领弧度：关注自然翻折而非压成死线。",
              "针脚与收边：复核整洁、牢固与摩擦感。",
            ].map((x, i) => (
              <article className="at-card" key={x}>
                <small>CRAFT / 0{i + 1}</small>
                <p>{x}</p>
              </article>
            ))}
          </div>
        </>
      );
      break;
    case 14:
      content = (
        <>
          <div className="at-measures">
            <label className="at-field">
              启动日期
              <input
                type="date"
                value={s.start}
                onChange={(e) => {
                  if (dateValid(e.target.value))
                    change({ start: e.target.value });
                }}
              />
            </label>
            <label className="at-field">
              希望交付日期
              <input
                type="date"
                value={s.due}
                onChange={(e) => {
                  if (dateValid(e.target.value))
                    change({ due: e.target.value });
                }}
              />
            </label>
            {range("试衣缓冲天数", s.buffer, 0, 30, (n) =>
              change({ buffer: n }),
            )}
          </div>
          <ol className="at-timeline">
            {stages.map((name, i) => (
              <li key={name}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{name}</h3>
                  <p>{stageNotes[i]}</p>
                </div>
                <time>{dates.dates[i]}</time>
              </li>
            ))}
          </ol>
          <p
            className={s.due < dates.dates[5] ? "at-warning" : "at-disclosure"}
          >
            预计 {dates.days} 个日历天，计划交付 {dates.dates[5]}。
            {s.due < dates.dates[5]
              ? "希望日期早于计划，存在交期风险。"
              : "希望日期不早于此演算计划；仍不是交期承诺。"}
          </p>
        </>
      );
      break;
    case 15:
      content = (
        <div className="at-two">
          <div>{image("tools", "量体与制版工具")}</div>
          <div>
            <label className="at-field">
              意向试衣日期
              <input
                type="date"
                value={s.appointmentDate}
                onChange={(e) => {
                  if (dateValid(e.target.value))
                    change({
                      appointmentDate: e.target.value,
                      appointmentSaved: false,
                    });
                }}
              />
            </label>
            {choose("意向时段", s.slot, ["10:00", "14:00", "16:30"], (slot) =>
              change({ slot, appointmentSaved: false }),
            )}
            {choose(
              "沟通方式",
              s.meeting,
              ["到店意向", "远程沟通"],
              (meeting) => change({ meeting, appointmentSaved: false }),
            )}
            <button
              onClick={() => {
                change({ appointmentSaved: true });
                msg("试衣意向已保存到方案，未预约或发送通知。");
              }}
            >
              保存试衣意向
            </button>
            <p>
              {s.appointmentSaved ? "已保存：" : "当前草稿："}
              {s.appointmentDate} / {["10:00", "14:00", "16:30"][s.slot]} ·
              无真实空位查询
            </p>
          </div>
        </div>
      );
      break;
    case 16:
      content = (
        <div className="at-two">
          <div>
            {text("客户称呼", "client")}
            {text("联系邮箱或电话", "contact")}
            {checks(
              ["同意将此资料用于这份方案；手动服务器备份会上传资料"],
              [s.consent],
              (v) => change({ consent: v[0] }),
            )}
            <button
              onClick={() => {
                const invalid = problems({
                  ...s,
                  verified: true,
                  measures: initial.measures,
                });
                msg(
                  invalid.length
                    ? invalid.join("；")
                    : "资料校验通过；未发送或联系客户。",
                );
              }}
            >
              检查联系资料
            </button>
          </div>
          <aside className="at-note">
            <h3>只保留必要的信息。</h3>
            <p>
              本模板不需要身份证号、银行卡或健康资料。建议在预览中使用示例信息。
            </p>
            <p>
              本机草稿和服务器快照是不同副本；退出账号不会清空本机内容。此处暂不提供生产级资料删除流程。
            </p>
          </aside>
        </div>
      );
      break;
    case 17:
      content = (
        <>
          <div className="at-measures">
            <label className="at-field">
              套装件数
              <input
                type="number"
                min={1}
                max={10}
                value={s.quantity}
                onChange={(e) =>
                  change({
                    quantity: Math.round(clamp(+e.target.value, 1, 10)),
                  })
                }
              />
            </label>
            {range("示例折扣百分比", s.discount, 0, 15, (discount) =>
              change({ discount }),
            )}
            {range("示例税率百分比", s.tax, 0, 15, (tax) => change({ tax }))}
          </div>
          {quoteTable}
          <button onClick={() => exportCSV(s)}>下载费用 CSV</button>
          <p>
            全部金额为示例；税费基于折后金额演算，不提供税务意见。CSV
            不是正式账单。
          </p>
        </>
      );
      break;
    case 18:
      content = (
        <div className="at-two">
          <div>
            {checks(fitLabels, s.fitChecks, (fitChecks) =>
              change({ fitChecks }),
            )}
            {text("本次试衣观察", "fitNotes", true)}
            <button
              onClick={() => {
                if (s.fitNotes.trim().length < 6) {
                  msg("请至少写 6 个字符描述试衣观察。");
                  return;
                }
                change({
                  fittings: [
                    {
                      at: new Date().toISOString(),
                      notes: s.fitNotes.trim(),
                      checks: [...s.fitChecks],
                    },
                    ...s.fittings,
                  ].slice(0, 5),
                });
                msg("已保存独立试衣记录，没有自动改写量体尺寸。");
              }}
            >
              保存试衣记录
            </button>
          </div>
          <aside>
            <h3>最近五次观察</h3>
            {s.fittings.length ? (
              s.fittings.map((f, i) => (
                <article className="at-card" key={f.at + i}>
                  <small>
                    {f.at.slice(0, 10)} · 已复核{" "}
                    {f.checks.filter(Boolean).length}/5
                  </small>
                  <p>{f.notes}</p>
                </article>
              ))
            ) : (
              <p>
                尚无个人记录。建议按「部位 → 动作 → 问题 →
                期望」描述，例如：抬手时袖口牵拉，希望先检查袖窿活动量，再决定是否改袖长。
              </p>
            )}
          </aside>
        </div>
      );
      break;
    case 19:
      content = (
        <>
          <div className="at-two">
            <div>
              <h3>确认前复核</h3>
              <p>{summary(s)}</p>
              <strong className="at-price">{money(q.total)}</strong>
              {issues.length ? (
                <ul className="at-warning">
                  {issues.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  输入检查通过。该检查不代表面料可售、服务方接单或实际合体。
                </p>
              )}
              <button
                className="at-primary"
                disabled={issues.length > 0}
                onClick={() => {
                  if (problems(s).length) return;
                  if (
                    s.order &&
                    !confirm("替换已有本地演示单？请先导出原项目备份。")
                  )
                    return;
                  change({
                    order: {
                      id:
                        "LOCAL-" +
                        crypto.randomUUID().slice(0, 8).toUpperCase(),
                      at: new Date().toISOString(),
                      client: s.client,
                      summary: summary(s),
                      measures: structuredClone(s.measures),
                      lines: structuredClone(q.lines),
                      total: q.total,
                      contact: s.contact,
                      quantity: s.quantity,
                      discount: s.discount,
                      tax: s.tax,
                      discountAmount: q.discount,
                      taxAmount: q.tax,
                      status: "active",
                      progress: 0,
                    },
                  });
                  msg("本地演示单已生成；未付款、未锁库存、未发送。");
                }}
              >
                生成本地演示单
              </button>
            </div>
            <aside className="at-receipt">
              <small>LOCAL SPECIFICATION / NOT AN ORDER</small>
              {s.order ? (
                <>
                  <h3>{s.order.id}</h3>
                  <p>
                    {s.order.client} / {s.order.at.slice(0, 10)}
                  </p>
                  <p>{s.order.summary}</p>
                  <b>{money(s.order.total)}</b>
                  <p>
                    {s.order.quantity} 件 · 折扣 {s.order.discount}% · 税率{" "}
                    {s.order.tax}%<br />
                    确认时联系：{s.order.contact}
                  </p>
                  <p>
                    {s.order.status === "cancelled"
                      ? "本地演示单已取消"
                      : "这是确认时的独立快照，草稿修改不会改变此金额。"}
                  </p>
                  <button
                    disabled={s.order.status === "cancelled"}
                    onClick={() => {
                      if (confirm("取消本地演示单？这不是商家退款操作。"))
                        change({ order: { ...s.order!, status: "cancelled" } });
                    }}
                  >
                    取消本地演示单
                  </button>
                </>
              ) : (
                <>
                  <h3>
                    这里将出现
                    <br />
                    确认时的规格。
                  </h3>
                  <p>
                    需要有效量体、客户称呼、联系信息与授权。示例默认数据必须先自行核对。
                  </p>
                </>
              )}
            </aside>
          </div>
        </>
      );
      break;
    case 20:
      content = (
        <>
          <p className="at-disclosure">
            {s.order
              ? `${s.order.id} · ${s.order.status === "cancelled" ? "已取消，进度冻结" : "手动跟踪中"}`
              : "尚未生成演示单，以下是制作流程说明。"}
          </p>
          <div className="at-production">
            {stages.map((stage, i) => (
              <article
                className={
                  s.order && s.order.progress > i
                    ? "at-card complete"
                    : "at-card"
                }
                key={stage}
              >
                <small>STEP 0{i + 1}</small>
                <h3>{stage}</h3>
                <p>{stageNotes[i]}</p>
                <button
                  disabled={
                    !s.order ||
                    s.order.status === "cancelled" ||
                    s.order.progress !== i
                  }
                  onClick={() =>
                    change({ order: { ...s.order!, progress: i + 1 } })
                  }
                >
                  {s.order && s.order.progress > i
                    ? "手动标记已完成"
                    : "标记完成：" + stage}
                </button>
              </article>
            ))}
          </div>
          <button
            disabled={
              !s.order ||
              s.order.status === "cancelled" ||
              s.order.progress === 0
            }
            onClick={() => {
              if (confirm("重置本地制作进度？"))
                change({ order: { ...s.order!, progress: 0 } });
            }}
          >
            重置本地进度
          </button>
        </>
      );
      break;
    case 21:
      content = (
        <div className="at-two">
          {image("lapel", "驳领与手工细节")}
          <div>
            <small>CARE / {fabrics[s.fabric].name}</small>
            <h3>
              衣服也需要，
              <br />
              休息的时间。
            </h3>
            <p>{fabrics[s.fabric].care}</p>
            <ol>
              <li>穿后先通风，再放回拥挤的衣柜。</li>
              <li>使用宽肩衣架，口袋尽量不长时间放重物。</li>
              <li>不要自行高温处理污渍，先查实物洗标。</li>
              <li>季末收纳前检查潮气与虫蛀风险。</li>
            </ol>
            <button onClick={() => go(3)}>更换方案面料 →</button>
          </div>
        </div>
      );
      break;
    case 22:
      content = (
        <div className="at-two">
          <div>
            {choose(
              "需要沟通的部位",
              s.issue,
              ["肩部", "袖长", "腰部", "裤长"],
              (issue) => change({ issue }),
            )}
            {text("问题与期望调整", "alteration", true)}
            {choose(
              "希望沟通的方式",
              s.returnMethod,
              ["到店意向", "远程先咨询"],
              (returnMethod) => change({ returnMethod }),
            )}
            <button
              onClick={() => {
                if (s.alteration.trim().length < 10) {
                  msg("请至少填写 10 个字符描述问题。");
                  return;
                }
                download(
                  new Blob([alterationText(s)], {
                    type: "text/plain;charset=utf-8",
                  }),
                  "atelier-alteration.txt",
                );
                msg("改衣沟通单已导出；未发送、未受理。");
              }}
            >
              导出改衣沟通单
            </button>
          </div>
          <aside className="at-note">
            <h3>调整前，先判断可行性。</h3>
            <p>
              放量取决于剩余缝份；移动肩点可能影响袖窿。不要仅按照片自行剪裁。
            </p>
            <p>
              需要实际服务方评估费用、时间和风险。此处不生成快递单，也不会承诺免费改衣。
            </p>
          </aside>
        </div>
      );
      break;
    default:
      content = (
        <>
          <div className="at-delivery">
            <div>
              <small>YOUR PERSONAL EDITION</small>
              <h3>{s.project}</h3>
              <p>{summary(s)}</p>
              <b>{money(q.total)}</b>
            </div>
            <div>
              <button onClick={() => exportJSON(s)}>导出项目 JSON</button>
              <button onClick={() => exportCSV(s)}>下载费用 CSV</button>
              <button
                disabled={busy}
                onClick={() => void runExport(() => exportSVG(s))}
              >
                下载技术 SVG
              </button>
              <button
                disabled={busy}
                onClick={() => void runExport(() => exportHTML(s))}
              >
                {busy ? "正在打包素材…" : "导出独立方案 HTML"}
              </button>
            </div>
          </div>
          <label className="at-import">
            从项目 JSON 恢复
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 500000) throw Error("文件不能超过 500 KB。");
                  const raw = JSON.parse(await file.text());
                  if (
                    raw.format !== "atelier-project-v1" ||
                    !raw.state ||
                    typeof raw.state.project !== "string" ||
                    !raw.state.measures
                  )
                    throw Error("不是 ATELIER 项目文件。");
                  if (!confirm("恢复项目会替换当前草稿，是否继续？")) return;
                  change(restore(raw.state));
                  msg("已恢复项目；服务器版本未被自动覆盖。");
                } catch (err) {
                  msg(err instanceof Error ? err.message : "恢复失败。");
                }
              }}
            />
          </label>
          <div className="at-two">
            <article className="at-card">
              <h3>哪些内容会被交付？</h3>
              <p>
                JSON 包含当前完整状态与演示单；CSV 包含当前费用；SVG
                包含技术示意；HTML 有 24
                个章节、五张内嵌图和中文字体。命名版本仍只留在当前浏览器。
              </p>
            </article>
            <article className="at-card">
              <h3>素材与边界</h3>
              <p>
                五张图均为本项目新生成的 AI
                概念图，不是实拍、真实商品或人物代言。配色与尺寸只改变技术图和参数，不重绘照片。没有实际支付、预约、工厂排产或物流。
              </p>
            </article>
          </div>
        </>
      );
  }
  return (
    <main className="sample-viewer atelier-viewer">
      <SampleTop
        type="原型 / 24 个内容页面"
        title="ATELIER · 独立服饰订制"
        draftId={draftId}
        onCopy={() => {
          try {
            copySample("atelier", s);
          } catch {
            msg("副本保存失败，请先导出项目。");
          }
        }}
      >
        <button onClick={() => go(23)}>交付档案 ↗</button>
      </SampleTop>
      <Notice text={error || notice} />
      <div className="at-history">
        <span>{error ? "本机保存失败" : "本地自动保存 · 方案工作台"}</span>
        <button
          disabled={!undo.current.length}
          onClick={() => {
            const p = undo.current.pop();
            if (p) {
              redo.current.push(s);
              set({ ...p, page: s.page });
            }
          }}
        >
          撤销
        </button>
        <button
          disabled={!redo.current.length}
          onClick={() => {
            const p = redo.current.pop();
            if (p) {
              undo.current.push(s);
              set({ ...p, page: s.page });
            }
          }}
        >
          重做
        </button>
        <input
          aria-label="版本名称"
          value={versionName}
          maxLength={40}
          placeholder="给方案命名一个版本"
          onChange={(e) => setVersionName(e.target.value)}
        />
        <button onClick={saveVersion}>保存版本</button>
        <select
          aria-label="恢复命名版本"
          value=""
          onChange={(e) => {
            const v = versions[+e.target.value];
            if (v && confirm("恢复这个命名版本？当前草稿将被替换。"))
              change(structuredClone(v.state));
          }}
        >
          <option value="">恢复版本（{versions.length}/6）</option>
          {versions.map((v, i) => (
            <option value={i} key={i}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="at-shell">
        <header className="at-brand">
          <a
            href="/inspiration/atelier"
            onClick={(e) => {
              e.preventDefault();
              go(0);
            }}
          >
            ATELIER<span>INDEPENDENT TAILORING</span>
          </a>
          <div>
            <small>PERSONAL PROJECT</small>
            <b>{s.project}</b>
          </div>
          <button onClick={() => go(17)}>
            方案预估 <strong>{money(q.total)}</strong>
          </button>
        </header>
        <nav className="at-pages" aria-label="ATELIER 页面目录">
          {pages.map((p, i) => (
            <button
              key={p[0]}
              aria-current={s.page === i ? "page" : undefined}
              onClick={() => go(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {p[0]}
            </button>
          ))}
        </nav>
        <section
          className={"at-page at-page-" + s.page}
          aria-label={pages[s.page][0]}
          data-page={s.page}
        >
          {s.page !== 0 && (
            <header className="at-heading">
              <small>
                ATELIER / {String(s.page + 1).padStart(2, "0")} —{" "}
                {pages[s.page][0]}
              </small>
              <h1>{pages[s.page][1]}</h1>
              <p>{pages[s.page][2]}</p>
            </header>
          )}
          {content}
        </section>
        <footer className="at-footer">
          <span>
            {String(s.page + 1).padStart(2, "0")} / 24 · 真实本地编辑 /
            非营业系统
          </span>
          <div>
            <button disabled={s.page === 0} onClick={() => go(s.page - 1)}>
              上一页
            </button>
            <button disabled={s.page === 23} onClick={() => go(s.page + 1)}>
              下一页 →
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
