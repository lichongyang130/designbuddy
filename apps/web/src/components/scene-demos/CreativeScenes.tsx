import { brandSvg } from "./Delivery";
import { uploadImage } from "./files";
import { useSceneState } from "./workspace";
import { useState, type CSSProperties } from "react";
import {
  art,
  Badge,
  Field,
  Select,
  Toolbar,
  money,
  numberInput,
  downloadText,
  csvCell,
  type DemoProps,
} from "./shared";
const rooms = [
  {
    name: "湖景木屋",
    en: "LAKE CABIN",
    price: 1280,
    img: art.hotel,
    size: "48㎡",
    bed: "1 张大床",
    detail: "独立露台 · 湖景 · 双人早餐",
  },
  {
    name: "林间套房",
    en: "FOREST SUITE",
    price: 1680,
    img: art.suite,
    size: "68㎡",
    bed: "1 张特大床",
    detail: "落地窗 · 休憩区 · 双人早餐",
  },
];
export function Prototype() {
  const [roomOptions, setRoomOptions] = useSceneState("roomOptions", rooms),
    [bookings, setBookings] = useSceneState<
      {
        id: string;
        room: number;
        name: string;
        checkin: string;
        checkout: string;
        guests: string;
        total: number;
      }[]
    >("bookings", []);
  const [screen, setScreen] = useSceneState("screen", 0),
    [room, setRoom] = useSceneState("room", 0),
    [saved, setSaved] = useSceneState<number[]>("saved", []),
    [tab, setTab] = useSceneState("tab", "探索"),
    [checkin, setCheckin] = useSceneState("checkin", "2026-11-01"),
    [checkout, setCheckout] = useSceneState("checkout", "2026-11-03"),
    [guests, setGuests] = useSceneState("guests", "2"),
    [name, setName] = useSceneState("name", ""),
    [error, setError] = useSceneState("error", "");
  const rawNights = (Date.parse(checkout) - Date.parse(checkin)) / 86400000;
  const validNights =
    Number.isFinite(rawNights) && rawNights > 0 && rawNights <= 30;
  const nights = validNights ? rawNights : 0;
  const current = roomOptions[room];
  const toggleSave = () =>
    setSaved((v) =>
      v.includes(room) ? v.filter((n) => n !== room) : [...v, room],
    );
  return (
    <div className="pd-travel-prototype">
      <div className="pd-prototype-presentation">
        <small>HOSPITALITY / MOBILE EXPERIENCE</small>
        <h1>
          远离喧嚣，
          <br />
          <em>靠近日常之外。</em>
        </h1>
        <p>湖岸旅居 App 原型</p>
        <details className="ws-context-editor">
          <summary>编辑客房与价格</summary>
          {roomOptions.map((r, i) => (
            <div key={i}>
              <Field
                label={`客房${i + 1}名称`}
                value={r.name}
                onChange={(name) =>
                  setRoomOptions((v) =>
                    v.map((x, n) => (n === i ? { ...x, name } : x)),
                  )
                }
              />
              <Field
                label={`客房${i + 1}每晚价格`}
                type="number"
                value={String(r.price)}
                onChange={(price) =>
                  setRoomOptions((v) =>
                    v.map((x, n) =>
                      n === i ? { ...x, price: numberInput(price, 100000) } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
        </details>
        <div className="pd-prototype-flow">
          {["发现目的地", "查看客房", "填写入住信息", "预约确认预览"].map(
            (n, i) => (
              <button
                aria-current={screen === i ? "step" : undefined}
                key={n}
                disabled={i === 3}
                onClick={() => setScreen(i)}
              >
                <span>0{i + 1}</span>
                {n}
              </button>
            ),
          )}
        </div>
        <Badge tone="neutral">4 个页面 · 完整本地流程</Badge>
        <section className="ws-booking-list">
          <h3>我的行程草稿 / {bookings.length}</h3>
          {bookings.length === 0 && (
            <small>在确认页保存草稿，之后可继续修改。</small>
          )}
          {bookings.map((b) => (
            <article key={b.id}>
              <strong>
                {roomOptions[b.room]?.name} · {b.name}
              </strong>
              <span>
                {b.checkin} → {b.checkout} / {money(b.total)}
              </span>
              <div>
                <button
                  onClick={() => {
                    setRoom(b.room);
                    setName(b.name);
                    setCheckin(b.checkin);
                    setCheckout(b.checkout);
                    setGuests(b.guests);
                    setScreen(2);
                  }}
                >
                  继续编辑
                </button>
                <button
                  onClick={() => {
                    if (confirm("删除这份本地行程草稿？"))
                      setBookings((v) => v.filter((x) => x.id !== b.id));
                  }}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </section>
        <small>
          虚构酒店 / AI 概念图片
          <br />
          不会创建真实预订或支付订单。
        </small>
      </div>
      <div className="pd-phone-device">
        <div className="pd-phone-system">
          <span>9:41</span>
          <i />
          <span>▰ ●</span>
        </div>
        <div className="pd-phone-content">
          {screen === 0 ? (
            <>
              <header>
                <div>
                  <small>LAKESIDE RETREAT</small>
                  <h2>{tab === "收藏" ? "我的心愿单" : "去山野，住几天。"}</h2>
                </div>
                <span>⌖ 湖岸</span>
              </header>
              {tab === "探索" && (
                <>
                  <div className="pd-travel-hero">
                    <img src={art.hotel} alt="森林与湖泊环绕的度假木屋" />
                    <div>
                      <small>THE QUIET COLLECTION</small>
                      <strong>把时间，留给自己。</strong>
                    </div>
                  </div>
                  <div className="pd-trip-search">
                    <span>
                      11.01 — 11.03<small>入住 / 离店</small>
                    </span>
                    <span>
                      {guests} 位<small>住客</small>
                    </span>
                    <button
                      onClick={() => {
                        setScreen(2);
                        setRoom(0);
                      }}
                    >
                      查看房态 ↗
                    </button>
                  </div>
                </>
              )}
              <div className="pd-phone-section-title">
                <h3>{tab === "收藏" ? "收藏的客房" : "精选房型"}</h3>
                <small>
                  共 {tab === "收藏" ? saved.length : roomOptions.length} 种
                </small>
              </div>
              {roomOptions.map(
                (r, i) =>
                  (tab !== "收藏" || saved.includes(i)) && (
                    <button
                      className="pd-room-card"
                      key={r.name}
                      onClick={() => {
                        setRoom(i);
                        setScreen(1);
                      }}
                    >
                      <img src={r.img} alt={r.name} />
                      <div>
                        <small>{r.en}</small>
                        <strong>{r.name}</strong>
                        <span>
                          {r.size} / {r.bed}
                        </span>
                        <b>
                          {money(r.price)} <small>/ 晚起</small>
                        </b>
                      </div>
                      <span>↗</span>
                    </button>
                  ),
              )}
              {tab === "收藏" && !saved.length && (
                <p className="pd-empty">还没有收藏，探索客房后点击收藏。</p>
              )}
            </>
          ) : screen === 1 ? (
            <>
              <div className="pd-room-detail-photo">
                <img src={current.img} alt={current.name} />
                <button onClick={() => setScreen(0)} aria-label="返回房型列表">
                  ←
                </button>
                <button
                  onClick={toggleSave}
                  aria-label={
                    saved.includes(room) ? "取消收藏客房" : "收藏客房"
                  }
                >
                  {saved.includes(room) ? "♥" : "♡"}
                </button>
              </div>
              <section className="pd-room-detail">
                <small>{current.en} / LAKESIDE RETREAT</small>
                <h2>{current.name}</h2>
                <p>{current.detail}</p>
                <div className="pd-room-facts">
                  <span>
                    {current.size}
                    <small>空间面积</small>
                  </span>
                  <span>
                    2 位<small>建议人数</small>
                  </span>
                  <span>
                    含早餐<small>入住礼遇</small>
                  </span>
                </div>
                <h3>住进风景里</h3>
                <p>自然材质、舒适床品与宽阔窗景，让旅程回到放松本身。</p>
                <div className="pd-room-amenities">
                  Wi-Fi　/　空调　/　私人卫浴　/　露台
                </div>
                <div className="pd-room-book">
                  <strong>
                    {money(current.price)} <small>/ 晚</small>
                  </strong>
                  <button className="pd-primary" onClick={() => setScreen(2)}>
                    选择日期 →
                  </button>
                </div>
              </section>
            </>
          ) : screen === 2 ? (
            <section className="pd-booking-form">
              <button className="pd-back-link" onClick={() => setScreen(1)}>
                ← 返回客房
              </button>
              <h2>安排你的入住</h2>
              <div className="pd-booking-room">
                <img src={current.img} alt={current.name} />
                <div>
                  <strong>{current.name}</strong>
                  <small>{current.detail}</small>
                </div>
              </div>
              <Field
                label="入住日期"
                type="date"
                value={checkin}
                onChange={setCheckin}
              />
              <Field
                label="离店日期"
                type="date"
                value={checkout}
                onChange={setCheckout}
              />
              <Select
                label="入住人数"
                value={guests}
                onChange={setGuests}
                options={[
                  ["1", "1 位成人"],
                  ["2", "2 位成人"],
                ]}
              />
              <Field label="入住人姓名" value={name} onChange={setName} />
              <div className="pd-booking-total">
                <span>
                  {nights} 晚 × {money(current.price)}
                </span>
                <strong>{money(nights * current.price)}</strong>
              </div>
              <button
                className="pd-primary"
                onClick={() => {
                  if (!validNights) {
                    setError("请选择有效日期，离店须晚于入住，最多 30 晚。");
                    return;
                  }
                  if (!name.trim()) {
                    setError("请填写入住人姓名。");
                    return;
                  }
                  setError("");
                  setScreen(3);
                }}
              >
                生成预约预览
              </button>
              {error && <p role="alert">{error}</p>}
              <small>仅生成本地预览，不预占房间、不扣款。</small>
            </section>
          ) : (
            <section className="pd-reservation-result">
              <span>✓</span>
              <h2>预约预览已生成</h2>
              <p>你好，{name}。以下是你的行程预览。</p>
              <img src={current.img} alt={current.name} />
              <h3>{current.name}</h3>
              <dl>
                <div>
                  <dt>日期</dt>
                  <dd>
                    {checkin} — {checkout}
                  </dd>
                </div>
                <div>
                  <dt>住客</dt>
                  <dd>
                    {guests} 位 · {nights} 晚
                  </dd>
                </div>
                <div>
                  <dt>示例总价</dt>
                  <dd>{money(nights * current.price)}</dd>
                </div>
              </dl>
              <Badge tone="amber">不是有效预订凭证</Badge>
              <button
                disabled={bookings.length >= 20}
                onClick={() => {
                  const exists = bookings.some(
                    (b) =>
                      b.room === room &&
                      b.name === name &&
                      b.checkin === checkin &&
                      b.checkout === checkout &&
                      b.guests === guests,
                  );
                  if (exists) {
                    setError("相同行程草稿已保存。");
                    return;
                  }
                  setBookings((v) => [
                    ...v,
                    {
                      id: crypto.randomUUID(),
                      room,
                      name,
                      checkin,
                      checkout,
                      guests,
                      total: nights * current.price,
                    },
                  ]);
                  setError("已保存到本地行程草稿，没有创建真实预订。");
                }}
              >
                保存行程草稿
              </button>
              {error && <p role="status">{error}</p>}
              <button
                onClick={() => {
                  setScreen(0);
                  setTab("探索");
                }}
              >
                返回探索
              </button>
            </section>
          )}
        </div>
        <nav>
          {["探索", "收藏"].map((t) => (
            <button
              aria-pressed={tab === t && screen === 0}
              key={t}
              onClick={() => {
                setTab(t);
                setScreen(0);
              }}
            >
              {t === "探索" ? "⌂" : "♡"}　{t}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

const projects = [
  {
    title: "光，塑造空间",
    category: "空间设计",
    year: "2026",
    image: art.interior,
    subtitle: "COURTYARD / RESIDENTIAL",
    text: "用光线组织日常，在天然材质之间建立安静而有层次的居住体验。",
  },
  {
    title: "水岸之间",
    category: "旅居设计",
    year: "2025",
    image: art.hotel,
    subtitle: "LAKESIDE / HOSPITALITY",
    text: "让建筑退到自然之后，以尺度与视线串联旅居的每一个时刻。",
  },
  {
    title: "林间的清晨",
    category: "旅居设计",
    year: "2026",
    image: art.suite,
    subtitle: "FOREST / INTERIOR",
    text: "从一扇窗开始，让舒适、秩序和自然重新连接。",
  },
];
export function InterfaceScene() {
  const [projectList, setProjectList] = useSceneState("projectList", projects),
    [siteTitle, setSiteTitle] = useSceneState(
      "siteTitle",
      "空间，\n与生活的关系。",
    ),
    [heroImage, setHeroImage] = useSceneState("heroImage", art.interior),
    [focus, setFocus] = useSceneState("focus", 50),
    [introFirst, setIntroFirst] = useSceneState("introFirst", false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useSceneState("page", "首页"),
    [dark, setDark] = useSceneState("dark", false),
    [filter, setFilter] = useSceneState("filter", "全部"),
    [detail, setDetail] = useSceneState<number | null>("detail", null);
  return (
    <div className={`pd-architecture ${dark ? "dark" : ""}`}>
      <nav>
        <strong>
          FORM<span>ARCHITECTURE & INTERIORS</span>
        </strong>
        <div>
          {["首页", "作品", "关于"].map((p) => (
            <button
              aria-current={page === p ? "page" : undefined}
              key={p}
              onClick={() => {
                setPage(p);
                setDetail(null);
              }}
            >
              {p}
            </button>
          ))}
          <button onClick={() => setDark((v) => !v)} aria-label="切换明暗主题">
            {dark ? "☼" : "◐"}
          </button>
        </div>
      </nav>
      {detail !== null ? (
        <article className="pd-architecture-detail">
          <button onClick={() => setDetail(null)}>← 返回作品</button>
          <small>{projectList[detail].subtitle}</small>
          <h1>
            <input
              aria-label="项目标题"
              className="ws-inline-heading"
              maxLength={100}
              value={projectList[detail].title}
              onChange={(e) =>
                setProjectList((v) =>
                  v.map((x, i) =>
                    i === detail ? { ...x, title: e.target.value } : x,
                  ),
                )
              }
            />
          </h1>
          <img
            src={projectList[detail].image}
            alt={projectList[detail].title}
          />
          <div>
            <p>
              <textarea
                aria-label="项目介绍"
                className="ws-inline-copy"
                rows={4}
                value={projectList[detail].text}
                onChange={(e) =>
                  setProjectList((v) =>
                    v.map((x, i) =>
                      i === detail ? { ...x, text: e.target.value } : x,
                    ),
                  )
                }
              />
            </p>
            <dl>
              <div>
                <dt>类别</dt>
                <dd>{projectList[detail].category}</dd>
              </div>
              <div>
                <dt>年份</dt>
                <dd>{projectList[detail].year}</dd>
              </div>
              <div>
                <dt>项目性质</dt>
                <dd>虚构概念项目</dd>
              </div>
            </dl>
          </div>
        </article>
      ) : page === "首页" ? (
        <div
          className="ws-architecture-home"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <header className="pd-architecture-heading">
            <small>
              WE SHAPE SPACES.
              <br />
              SPACES SHAPE US.
            </small>
            <h1>
              <textarea
                aria-label="作品集主标题"
                className="ws-inline-heading"
                rows={2}
                value={siteTitle}
                maxLength={100}
                onChange={(e) => setSiteTitle(e.target.value)}
              />
            </h1>
            <p>
              建筑 · 室内 · 场所
              <br />
              以感知为起点，以日常为尺度。
            </p>
          </header>
          <div className="pd-architecture-hero">
            <img
              src={heroImage}
              alt="自然光照射的当代住宅空间"
              style={{ objectPosition: `${focus}% center` }}
            />
            <button onClick={() => setDetail(0)}>
              01 / 光，塑造空间 <span>查看项目 ↗</span>
            </button>
          </div>
          <section
            className="pd-architecture-intro"
            style={{ order: introFirst ? -1 : 0 }}
          >
            <h2>
              克制的表达，
              <br />
              丰盈的体验。
            </h2>
            <p>
              FORM
              是虚构的建筑与室内设计工作室。页面以真实感空间摄影为视觉核心，让项目、材料和叙事各自拥有合适的展示尺度。
            </p>
            <button onClick={() => setPage("作品")}>浏览精选作品 ↗</button>
          </section>
        </div>
      ) : page === "作品" ? (
        <section className="pd-architecture-work">
          <header>
            <small>SELECTED WORKS / 2025—2026</small>
            <h1>每一处空间，都有自己的答案。</h1>
            <div>
              {["全部", "空间设计", "旅居设计"].map((t) => (
                <button
                  key={t}
                  aria-pressed={filter === t}
                  onClick={() => setFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </header>
          <div>
            {projectList.map(
              (p, i) =>
                (filter === "全部" || filter === p.category) && (
                  <button
                    className="pd-architecture-project"
                    key={p.title}
                    onClick={() => setDetail(i)}
                  >
                    <img src={p.image} alt={p.title} />
                    <small>
                      {p.category} / {p.year}
                    </small>
                    <h2>
                      {p.title} <span>↗</span>
                    </h2>
                  </button>
                ),
            )}
          </div>
        </section>
      ) : (
        <section className="pd-architecture-about">
          <small>ABOUT THE STUDIO</small>
          <h1>
            从理解生活开始，
            <br />
            重新思考设计。
          </h1>
          <img src={art.interior} alt="工作室空间概念" />
          <div>
            <h2>
              我们相信，好的空间
              <br />
              应该让日常自然发生。
            </h2>
            <p>
              在项目研究、材料选择与细节实现之间不断往返，用有限而精确的表达，回应人与环境的关系。本页为独立官网设计示例，不代表真实工作室业绩。
            </p>
          </div>
        </section>
      )}
      <details className="ws-context-editor">
        <summary>图片与页面结构</summary>
        <div className="ws-actions">
          <label className="ws-upload">
            {detail !== null ? "更换项目图片" : "更换首页摄影"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f)
                  try {
                    const data = await uploadImage(f);
                    if (detail !== null)
                      setProjectList((v) =>
                        v.map((x, i) =>
                          i === detail ? { ...x, image: data } : x,
                        ),
                      );
                    else setHeroImage(data);
                    setMessage("图片已更新。");
                  } catch (err) {
                    setMessage((err as Error).message);
                  }
              }}
            />
          </label>
          <label>
            首页图片焦点
            <input
              aria-label="作品集图片焦点"
              type="range"
              min="0"
              max="100"
              value={focus}
              onChange={(e) => setFocus(+e.target.value)}
            />
          </label>
          <button onClick={() => setIntroFirst((v) => !v)}>
            {introFirst ? "把工作室介绍放在摄影后" : "把工作室介绍移到最前"}
          </button>
        </div>
        <p role="status">{message}</p>
      </details>
      <footer>
        <strong>FORM /</strong>
        <span>Architecture. Interiors. Everyday life.</span>
        <small>AI 概念图片 · 虚构作品集</small>
      </footer>
    </div>
  );
}

export { Poster } from "./Poster";

const brandColors = [
  { name: "苔绿", color: "#425e50" },
  { name: "墨蓝", color: "#344961" },
  { name: "陶棕", color: "#825b47" },
];
export function Brand({ interactive }: DemoProps) {
  const [name, setName] = useSceneState("name", "栖间"),
    [english, setEnglish] = useSceneState("english", "SEREIN"),
    [tagline, setTagline] = useSceneState("tagline", "把片刻，留给自己。"),
    [palette, setPalette] = useSceneState("palette", 0),
    [serif, setSerif] = useSceneState("serif", true),
    [view, setView] = useSceneState("view", "品牌概览");
  const mark = (
    <span className="pd-brand-mark">
      <i aria-hidden="true">
        <svg width="1em" height="1em" viewBox="0 0 32 32" fill="none">
          <path
            d="M16 27V15M16 19C7 19 5 13 6 5c8 0 13 5 10 14ZM16 23c9 0 12-6 10-13-7 1-11 6-10 13Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m10 10 6 9m6-4-6 8"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      </i>
      <strong>{name}</strong>
      <small>{english}</small>
    </span>
  );
  return (
    <div
      className={`pd-tea-brand ${serif ? "serif" : ""}`}
      style={{ "--brand-ink": brandColors[palette].color } as CSSProperties}
    >
      <header>
        <strong>BRAND IDENTITY / 01</strong>
        <div>
          {["品牌概览", "应用规范"].map((t) => (
            <button
              key={t}
              aria-pressed={view === t}
              onClick={() => setView(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </header>
      {view === "品牌概览" ? (
        <>
          <section className="pd-brand-hero">
            <div>
              <small>CONTEMPORARY TEA CULTURE</small>
              {mark}
              <p>{tagline}</p>
              <span>茶 · 器 · 日常</span>
            </div>
            <div
              className="ws-brand-packaging"
              role="img"
              aria-label="与当前字标、字体和配色同步的矢量包装应用"
              dangerouslySetInnerHTML={{
                __html: brandSvg(
                  { name, english, tagline, palette, serif },
                  true,
                ),
              }}
            />
          </section>
          <section className="pd-brand-system">
            <div>
              <small>01 / COLOUR SYSTEM</small>
              <h2>来自自然，回到日常。</h2>
              <div className="pd-brand-colors">
                {[
                  brandColors[palette].color,
                  "#e8e2d5",
                  "#c1b49b",
                  "#272f2a",
                ].map((c, i) => (
                  <div key={c}>
                    <span style={{ background: c }} />
                    <small>{["主品牌色", "纸本白", "茶褐", "文字色"][i]}</small>
                    <code>{c.toUpperCase()}</code>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <small>02 / TYPOGRAPHY</small>
              <h2>
                {name} · {english}
              </h2>
              <p className="pd-brand-type-sample">
                慢一点，感受此刻。
                <br />
                <span>A quiet moment, thoughtfully made.</span>
              </p>
            </div>
          </section>
          <section className="pd-brand-applications">
            <div className="pd-brand-card">
              {mark}
              <p>林晓 / BRAND DIRECTOR</p>
              <small>
                hello@example.com
                <br />
                品牌名片 / 概念应用
              </small>
            </div>
            <div className="pd-brand-letterhead">
              <header>
                {mark}
                <small>LETTERHEAD / 01</small>
              </header>
              <h3>{tagline}</h3>
              <p>
                从茶的香气，到纸张的触感。
                <br />
                让视觉、语言与体验说同一种话。
              </p>
              <footer>{english} / TEA & EVERYDAY RITUALS</footer>
            </div>
            <div className="pd-brand-label">
              <small>原叶茶 / LOOSE LEAF TEA</small>
              {mark}
              <p>山野乌龙</p>
              <span>50g / CONCEPT PACKAGING</span>
            </div>
          </section>
        </>
      ) : (
        <section className="pd-brand-guidelines">
          <h1>让品牌在不同触点中保持一致。</h1>
          <div className="pd-brand-guide-grid">
            <article>
              <small>标识安全区</small>
              <div className="pd-logo-safe">{mark}</div>
              <p>
                四周保留至少一个字高的留白，不拉伸、不旋转，不覆盖复杂画面。
              </p>
            </article>
            <article>
              <small>最小应用示意</small>
              <div className="pd-logo-sizes">
                {mark}
                {mark}
              </div>
              <p>较小尺寸保留字标，减少辅助说明，优先确保辨识度。</p>
            </article>
            <article>
              <small>反白应用</small>
              <div className="pd-logo-reverse">{mark}</div>
              <p>深色背景统一使用浅色标识，避免低对比度配色。</p>
            </article>
          </div>
        </section>
      )}
      {interactive && (
        <section className="pd-brand-editor">
          <Field label="品牌名称" value={name} onChange={setName} />
          <Field label="英文名称" value={english} onChange={setEnglish} />
          <Field label="品牌标语" value={tagline} onChange={setTagline} />
          <div>
            <small>品牌主色</small>
            <div className="pd-brand-palette">
              {brandColors.map((c, i) => (
                <button
                  key={c.name}
                  aria-label={`${c.name}品牌色`}
                  aria-pressed={palette === i}
                  style={{ background: c.color }}
                  onClick={() => setPalette(i)}
                />
              ))}
            </div>
            <label className="pd-check">
              <input
                type="checkbox"
                checked={serif}
                onChange={(e) => setSerif(e.target.checked)}
              />
              使用衬线字标
            </label>
          </div>
        </section>
      )}
      <footer className="pd-brand-footer">
        虚构茶品牌 · 可编辑矢量包装应用 ·
        字标、配色、名片与信纸同步编辑，不代表商标注册。
      </footer>
    </div>
  );
}

const scheduleSeed = [
  {
    day: "周一",
    channel: "内容社区",
    title: "城市骑行的一天",
    format: "图文故事",
    status: "待拍摄",
  },
  {
    day: "周三",
    channel: "邮件通讯",
    title: "给日常留一点空间",
    format: "品牌邮件",
    status: "待审核",
  },
  {
    day: "周五",
    channel: "内容社区",
    title: "一件外套，三种通勤场景",
    format: "短视频",
    status: "已排期",
  },
  {
    day: "周日",
    channel: "线下活动",
    title: "周末慢骑计划",
    format: "体验活动",
    status: "待确认",
  },
];
export function Campaign() {
  const [audience, setAudience] = useSceneState(
      "audience",
      "25—35 岁城市通勤人群",
    ),
    [objective, setObjective] = useSceneState(
      "objective",
      "建立生活方式认知，让新用户理解产品适用场景。",
    ),
    [strategy, setStrategy] = useSceneState(
      "strategy",
      "以真实通勤故事为线索，联动内容社区、邮件与线下慢骑体验。",
    );
  const [dragged, setDragged] = useState<number | null>(null);
  const [title, setTitle] = useSceneState("title", "城市之间，自在出发。"),
    [budget, setBudget] = useSceneState("budget", 30000),
    [channels, setChannels] = useSceneState("channels", [true, true, true]),
    [weights, setWeights] = useSceneState("weights", [50, 20, 30]),
    [tab, setTab] = useSceneState("tab", "策略概览"),
    [schedule, setSchedule] = useSceneState(
      "schedule",
      scheduleSeed.map((s, i) => ({
        ...s,
        owner: ["林晓", "陈宁", "周远", "王栩"][i],
      })),
    );
  const labels = ["内容社区", "邮件通讯", "线下活动"],
    active = channels.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
    weightTotal = active.reduce((n, i) => n + weights[i], 0);
  const base = weights.map((w, i) =>
    channels[i] && weightTotal ? Math.floor((budget * w) / weightTotal) : 0,
  );
  if (active.length && weightTotal)
    base[active[0]] += budget - base.reduce((a, b) => a + b, 0);
  return (
    <div className="pd-campaign-workspace">
      <Toolbar brand="FIELDNOTES" title="品牌营销项目">
        <Badge tone="neutral">策划草案</Badge>
        <button
          onClick={() =>
            downloadText(
              "channel-budget.csv",
              "\uFEFF" +
                [
                  ["渠道", "权重", "分配预算"],
                  ...labels
                    .filter((_, i) => channels[i])
                    .map((label) => {
                      const i = labels.indexOf(label);
                      return [label, weights[i], base[i]];
                    }),
                ]
                  .map((r) => r.map(csvCell).join(","))
                  .join("\r\n"),
              "text/csv;charset=utf-8",
            )
          }
        >
          导出预算 ↓
        </button>
      </Toolbar>
      <div className="pd-campaign-banner">
        <img src={art.campaign} alt="城市骑行与通勤服饰的生活方式概念摄影" />
        <div>
          <small>URBAN EVERYDAY / AUTUMN CAMPAIGN</small>
          <h1>{title}</h1>
          <p>面向城市通勤人群的一次生活方式叙事。</p>
          <Badge tone="neutral">概念品牌 / 2026 秋季</Badge>
        </div>
      </div>
      <nav className="pd-campaign-tabs">
        {["策略概览", "内容排期", "预算分配"].map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="pd-campaign-body">
        {tab === "策略概览" ? (
          <>
            <div className="pd-campaign-brief">
              <article>
                <small>01 / OBJECTIVE</small>
                <h2>{objective}</h2>
                <p>
                  不是罗列产品参数，而是让用户看见产品如何进入通勤、周末与短途出行。
                </p>
              </article>
              <article>
                <small>02 / AUDIENCE</small>
                <h2>城市中的行动者</h2>
                <p>
                  关注舒适、效率与日常审美的通勤人群；通过小范围内容测试验证具体受众。
                </p>
              </article>
              <article>
                <small>03 / MESSAGE</small>
                <h2>自在，而不随意</h2>
                <p>
                  围绕「轻装出发」组织摄影、文案与体验活动，让不同渠道保持同一种语言。
                </p>
              </article>
            </div>
            <div className="pd-campaign-moodboard">
              <img src={art.campaign} alt="活动核心生活方式主视觉" />
              <div>
                <small>VISUAL & COPY DIRECTION</small>
                <h2>
                  保留真实的温度，
                  <br />
                  少一点过度的修饰。
                </h2>
                <p>
                  自然光、街道肌理、低饱和服饰；文案聚焦具体使用场景，避免无法验证的性能承诺。
                </p>
                <div>
                  <i style={{ background: "#596253" }} />
                  <i style={{ background: "#b7ad97" }} />
                  <i style={{ background: "#e9e4da" }} />
                  <i style={{ background: "#343a35" }} />
                </div>
              </div>
            </div>
            <div className="ws-two-columns">
              <Field label="传播主题" value={title} onChange={setTitle} />
              <Field label="目标受众" value={audience} onChange={setAudience} />
              <Field
                label="营销目标"
                value={objective}
                onChange={setObjective}
                multiline
              />
              <Field
                label="核心策略"
                value={strategy}
                onChange={setStrategy}
                multiline
              />
            </div>
          </>
        ) : tab === "内容排期" ? (
          <>
            <div className="pd-section-title">
              <h2>一周内容执行表</h2>
              <button
                disabled={schedule.length >= 40}
                onClick={() =>
                  setSchedule((v) => [
                    ...v,
                    {
                      day: "周一",
                      title: "新的内容主题",
                      channel: "内容社区",
                      format: "图文故事",
                      status: "待确认",
                      owner: "待分配",
                    },
                  ])
                }
              >
                ＋ 新增排期
              </button>
              <button
                onClick={() =>
                  downloadText(
                    "campaign-execution.csv",
                    "\uFEFF" +
                      [
                        ["日期", "主题", "渠道", "负责人", "状态"],
                        ...schedule.map((s) => [
                          s.day,
                          s.title,
                          s.channel,
                          s.owner,
                          s.status,
                        ]),
                      ]
                        .map((r) => r.map(csvCell).join(","))
                        .join("\r\n"),
                    "text/csv;charset=utf-8",
                  )
                }
              >
                导出执行表
              </button>
              <small>
                拖动卡片调整日期，或在下方表格选择日期；不会发布内容。
              </small>
            </div>
            <div className="pd-table-scroll">
              <div className="ws-campaign-calendar">
                {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map(
                  (day) => (
                    <div
                      className="ws-calendar-day"
                      key={day}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragged !== null)
                          setSchedule((v) =>
                            v.map((s, i) =>
                              i === dragged ? { ...s, day } : s,
                            ),
                          );
                        setDragged(null);
                      }}
                    >
                      <small>{day}</small>
                      {schedule.map(
                        (item, i) =>
                          item.day === day && (
                            <article
                              key={i}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", String(i));
                                e.dataTransfer.effectAllowed = "move";
                                setDragged(i);
                              }}
                              onDragEnd={() => setDragged(null)}
                            >
                              <strong>{item.title}</strong>
                              <small>
                                {item.channel} / {item.owner}
                              </small>
                            </article>
                          ),
                      )}
                    </div>
                  ),
                )}
              </div>
              <table aria-label="营销内容排期">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>渠道</th>
                    <th>内容主题</th>
                    <th>负责人 / 形式</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <select
                          aria-label={`排期${i + 1}日期`}
                          value={item.day}
                          onChange={(e) =>
                            setSchedule((v) =>
                              v.map((s, j) =>
                                j === i ? { ...s, day: e.target.value } : s,
                              ),
                            )
                          }
                        >
                          {[
                            "周一",
                            "周二",
                            "周三",
                            "周四",
                            "周五",
                            "周六",
                            "周日",
                          ].map((d) => (
                            <option key={d}>{d}</option>
                          ))}
                        </select>
                      </td>
                      <td>{item.channel}</td>
                      <td>
                        <input
                          aria-label={`排期${i + 1}主题`}
                          value={item.title}
                          maxLength={80}
                          onChange={(e) =>
                            setSchedule((v) =>
                              v.map((s, j) =>
                                j === i ? { ...s, title: e.target.value } : s,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`排期${i + 1}负责人`}
                          value={item.owner}
                          maxLength={30}
                          onChange={(e) =>
                            setSchedule((v) =>
                              v.map((s, j) =>
                                j === i ? { ...s, owner: e.target.value } : s,
                              ),
                            )
                          }
                        />
                        <small>{item.format}</small>
                      </td>
                      <td>
                        <button
                          aria-label={`切换${item.day}排期状态`}
                          onClick={() =>
                            setSchedule((v) =>
                              v.map((s, j) =>
                                i === j
                                  ? {
                                      ...s,
                                      status:
                                        s.status === "已排期"
                                          ? "待审核"
                                          : "已排期",
                                    }
                                  : s,
                              ),
                            )
                          }
                        >
                          <Badge
                            tone={item.status === "已排期" ? "green" : "amber"}
                          >
                            {item.status}
                          </Badge>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <section className="pd-campaign-checklist">
              <h3>发布前检查</h3>
              <p>
                素材来源确认 → 文案与事实核对 → 链接及追踪口径检查 → 负责人审批
              </p>
            </section>
          </>
        ) : (
          <div className="pd-budget-layout">
            <section>
              <h2>预算与渠道权重</h2>
              <Field
                label="总预算"
                value={budget}
                type="number"
                min={0}
                max={10000000}
                onChange={(v) =>
                  setBudget(Math.floor(numberInput(v, 10000000)))
                }
              />
              {labels.map((label, i) => (
                <div className="pd-budget-control" key={label}>
                  <label>
                    <input
                      type="checkbox"
                      checked={channels[i]}
                      onChange={() =>
                        setChannels((v) => v.map((n, j) => (i === j ? !n : n)))
                      }
                    />
                    {label}
                  </label>
                  <Field
                    label={`${label}权重`}
                    value={weights[i]}
                    type="number"
                    min={0}
                    max={100}
                    onChange={(v) =>
                      setWeights((w) =>
                        w.map((n, j) => (i === j ? numberInput(v, 100) : n)),
                      )
                    }
                  />
                </div>
              ))}
            </section>
            <section className="pd-budget-summary">
              <small>BUDGET ALLOCATION</small>
              <h1>{money(budget)}</h1>
              <p>按启用渠道的相对权重分配，余数归入首个启用渠道。</p>
              <div className="pd-budget-bar">
                {labels.map(
                  (label, i) =>
                    channels[i] && (
                      <span
                        key={label}
                        style={{
                          width: `${budget ? (base[i] / budget) * 100 : 0}%`,
                          background: ["#657b64", "#a2afbb", "#c5b99e"][i],
                        }}
                      />
                    ),
                )}
              </div>
              {labels.map(
                (label, i) =>
                  channels[i] && (
                    <div className="pd-budget-row" key={label}>
                      <span>{label}</span>
                      <strong>{money(base[i])}</strong>
                    </div>
                  ),
              )}
              {(!active.length || !weightTotal) && (
                <p role="status">请启用至少一个渠道，并设置大于零的权重。</p>
              )}
              <small>仅为预算计算，不预测收益、不执行广告投放。</small>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
