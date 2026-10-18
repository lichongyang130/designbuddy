import { useState } from "react";
import {
  copySample,
  Credits,
  download,
  museumPhotos as photos,
  Notice,
  SampleTop,
  useSampleState,
} from "./shared";
export const museumPages = [
  "展馆首页",
  "展览目录",
  "展览详情",
  "藏品索引",
  "藏品观察",
  "策展故事",
  "活动日历",
  "活动详情",
  "选择票种",
  "预约日期",
  "入场场次",
  "访客登记",
  "预约确认",
  "模拟预约",
  "预约完成",
  "电子凭证",
  "我的预约",
  "改期与取消",
  "收藏展览",
  "参观服务",
];
const shows = [
  {
    title: "时代的回声",
    tag: "艺术",
    subtitle: "从历史画面，读懂叙事的尺度。",
    description:
      "历史绘画不仅容纳人物，也组织观看的顺序。这个概念展览以一幅公开摄影中的陈列作品为起点，讨论构图、空间与集体记忆之间的关系。摄影仅作策展参考，不表示获得了该作品的展出授权。",
  },
  {
    title: "器物与时间",
    tag: "历史",
    subtitle: "一件器物，如何留下时代的痕迹。",
    description:
      "从结构、材质与使用环境出发，观察历史器物如何进入今天的公共展示。展览强调来源说明与背景研究，不以单张参考照片替代完整的历史论证。",
  },
  {
    title: "海岸的坐标",
    tag: "建筑",
    subtitle: "灯塔、海岸，以及远方的方向。",
    description:
      "概念展览围绕航行标志与海岸建筑展开。我们关注建筑如何成为辨认位置的线索，也关注摄影视角如何改变人们对体量与距离的感受。",
  },
  {
    title: "城市的切片",
    tag: "建筑",
    subtitle: "在立面与间隙中，发现城市日常。",
    description:
      "以建筑细部为线索，将观察从宏观轮廓移向窗口、墙面和光线。这里的图像是独立参考，不对应本展馆的真实建筑或一条已经勘验的参观路线。",
  },
  {
    title: "生活的收藏",
    tag: "生活",
    subtitle: "从日常空间开始，重新理解收藏。",
    description:
      "一间厨房中的器具与摆放方式，也能成为观察生活的材料。这个概念策展尝试将日常经验带进讨论，但不把私人空间摄影解释为馆藏或真实可预约场所。",
  },
];
const slots = ["10:00–11:30", "13:00–14:30", "15:30–17:00"];
const ticketTypes = [
  { name: "标准体验票", price: 80 },
  { name: "学生体验票", price: 45 },
  { name: "公益开放票", price: 0 },
];
const seed = {
  page: 0,
  exhibition: 0,
  object: 0,
  activity: 0,
  ticket: 0,
  quantity: 1,
  date: "2026-11-21",
  slot: 0,
  name: "",
  email: "",
  query: "",
  favorites: [] as number[],
  message: "",
  agreed: false,
  reservation: "",
  rescheduling: false,
};
type Reservation = {
  id: string;
  exhibition: number;
  ticket: number;
  quantity: number;
  date: string;
  slot: number;
  name: string;
  email: string;
  total: number;
  status: string;
};
function readReservation(raw: string): Reservation | null {
  try {
    const r = JSON.parse(raw);
    return r &&
      typeof r.id === "string" &&
      Number.isInteger(r.exhibition) &&
      r.exhibition >= 0 &&
      r.exhibition < 5 &&
      Number.isInteger(r.ticket) &&
      r.ticket >= 0 &&
      r.ticket < 3 &&
      Number.isInteger(r.slot) &&
      r.slot >= 0 &&
      r.slot < 3 &&
      Number.isInteger(r.quantity) &&
      r.quantity >= 1 &&
      r.quantity <= 6 &&
      [r.name, r.email, r.date, r.status].every((v) => typeof v === "string") &&
      Number.isFinite(r.total)
      ? r
      : null;
  } catch {
    return null;
  }
}
export function MuseumCover() {
  return (
    <div className="museum-cover">
      <div>
        <span>SHIGUANG / 城市文化观察馆</span>
        <h2>
          时间有形。
          <br />
          故事，等你走近。
        </h2>
        <p>EXHIBITIONS / OBJECTS / EVERYDAY LIFE</p>
      </div>
      <img src={photos[0].url} alt="历史绘画陈列参考摄影" />
      <b>
        05
        <br />
        <small>个概念展览</small>
      </b>
    </div>
  );
}
export default function MuseumPrototype({ draftId }: { draftId?: string }) {
  const [s, set, error] = useSampleState("museum", draftId, seed),
    [notice, msg] = useState(""),
    [filter, category] = useState("全部");
  const patch = (p: Partial<typeof seed>) => set((v) => ({ ...v, ...p }));
  const go = (page: number) => {
    patch({ page });
    msg("");
  };
  const page = Math.min(19, Math.max(0, s.page)),
    exhibition = Math.min(4, s.exhibition),
    object = Math.min(4, s.object),
    ticket = Math.min(2, s.ticket),
    slot = Math.min(2, s.slot),
    activity = Math.min(2, s.activity);
  const current = shows[exhibition],
    order = readReservation(s.reservation),
    total = ticketTypes[ticket].price * s.quantity;
  const favorite = (id: number) =>
    patch({
      favorites: s.favorites.includes(id)
        ? s.favorites.filter((x) => x !== id)
        : [...s.favorites, id],
    });
  const image = (i: number) => (
    <img src={photos[i].url} alt={photos[i].label} />
  );
  const cards = (items = shows.map((show, id) => ({ ...show, id }))) => (
    <div className="museum-cards">
      {items.map((show) => (
        <article key={show.id}>
          <button
            className="museum-picture"
            aria-label={`打开展览${show.title}`}
            onClick={() => {
              patch({ exhibition: show.id, page: 2 });
              msg("");
            }}
          >
            {image(show.id)}
          </button>
          <div>
            <span>{show.tag} / CONCEPT EXHIBITION</span>
            <h3>{show.title}</h3>
            <p>{show.subtitle}</p>
            <button
              aria-label={`收藏展览${show.title}`}
              aria-pressed={s.favorites.includes(show.id)}
              onClick={() => favorite(show.id)}
            >
              {s.favorites.includes(show.id) ? "★ 已收藏" : "☆ 收藏展览"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
  function copy() {
    try {
      copySample("museum", s);
    } catch {
      msg("无法保存副本，请导出演示预约。");
    }
  }
  function reserve() {
    if (!s.agreed || !s.name.trim() || !/^\S+@\S+\.\S+$/.test(s.email)) return;
    const r: Reservation = {
      id: "DEMO-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
      exhibition,
      ticket,
      quantity: s.quantity,
      date: s.date,
      slot,
      name: s.name,
      email: s.email,
      total,
      status: "已预约（演示）",
    };
    patch({ reservation: JSON.stringify(r), page: 14, rescheduling: false });
  }
  const downloadOrder = () =>
    download(
      new Blob(
        [
          JSON.stringify(
            {
              format: "museum-demo-reservation",
              reservation: order,
              photoCredits: photos,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "拾光-演示预约.json",
    );
  return (
    <main className="sample-view museum-view">
      <SampleTop
        type="展馆预约原型 · 20 个业务页面"
        title="拾光 · 城市文化观察馆"
        draftId={draftId}
        onCopy={copy}
      >
        <button onClick={downloadOrder}>导出演示预约</button>
      </SampleTop>
      <Notice text={error || notice} />
      <div className="museum-prototype">
        <span>虚构展馆 · 参考摄影非真实场馆 · 不收费、不提供入场资格</span>
        <label>
          浏览展馆页面
          <select
            aria-label="浏览展馆页面"
            value={page}
            onChange={(e) => go(Number(e.target.value))}
          >
            {museumPages.map((p, i) => (
              <option key={p} value={i}>
                {String(i + 1).padStart(2, "0")} / {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="museum-site" data-museum-page={page}>
        <header className="museum-nav">
          <button className="museum-wordmark" onClick={() => go(0)}>
            拾光<span>SHIGUANG MUSEUM</span>
          </button>
          <nav aria-label="展馆网站导航">
            {[
              [1, "展览"],
              [3, "藏品"],
              [6, "活动"],
              [16, "我的预约"],
              [19, "参观服务"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => go(Number(id))}>
                {label}
              </button>
            ))}
          </nav>
          <button onClick={() => go(18)} aria-label="展馆收藏夹">
            ☆ {s.favorites.length}
          </button>
        </header>
        {page === 0 ? (
          <>
            <MuseumCover />
            <section className="museum-section">
              <div className="museum-section-heading">
                <div>
                  <small>ON VIEW / 概念展览</small>
                  <h1>让好奇心，带路。</h1>
                </div>
                <button onClick={() => go(1)}>浏览所有展览 ↗</button>
              </div>
              {cards(shows.slice(0, 3).map((show, id) => ({ ...show, id })))}
            </section>
            <section className="museum-strip">
              <h2>
                从一件器物开始，
                <br />
                看见更大的世界。
              </h2>
              <button onClick={() => go(3)}>探索藏品索引 →</button>
              <button onClick={() => go(6)}>查看活动日历 →</button>
            </section>
          </>
        ) : (
          <section className="museum-section">
            <div className="museum-breadcrumb">
              <button onClick={() => go(0)}>首页</button> / {museumPages[page]}
            </div>
            {page === 1 && (
              <>
                <div className="museum-section-heading">
                  <div>
                    <small>EXHIBITION INDEX</small>
                    <h1>五种走近时间的方式。</h1>
                  </div>
                  <input
                    aria-label="搜索展览"
                    placeholder="搜索展名或主题"
                    value={s.query}
                    onChange={(e) => patch({ query: e.target.value })}
                  />
                </div>
                <div className="museum-filters">
                  {["全部", "艺术", "历史", "建筑", "生活"].map((x) => (
                    <button
                      key={x}
                      aria-pressed={filter === x}
                      onClick={() => category(x)}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                {cards(
                  shows
                    .map((show, id) => ({ ...show, id }))
                    .filter(
                      (show) =>
                        (filter === "全部" || show.tag === filter) &&
                        `${show.title}${show.subtitle}`.includes(
                          s.query.trim(),
                        ),
                    ),
                )}
                {!shows.some(
                  (show) =>
                    (filter === "全部" || show.tag === filter) &&
                    `${show.title}${show.subtitle}`.includes(s.query.trim()),
                ) && <p role="status">没有匹配的展览，试试其他主题。</p>}
              </>
            )}
            {page === 2 && (
              <>
                <div className="museum-exhibition">
                  <div>
                    <small>{current.tag} / CONCEPT EXHIBITION</small>
                    <h1>{current.title}</h1>
                    <h2>{current.subtitle}</h2>
                    <p>{current.description}</p>
                    <button
                      className="museum-primary"
                      onClick={() => {
                        patch({ page: 8, rescheduling: false });
                      }}
                    >
                      预约本展览 →
                    </button>
                    <button onClick={() => favorite(exhibition)}>
                      {s.favorites.includes(exhibition)
                        ? "已收藏展览"
                        : "收藏这个展览"}
                    </button>
                  </div>
                  {image(exhibition)}
                </div>
                <div className="museum-facts">
                  <p>展期 / 概念常设展</p>
                  <p>票价 / ¥0–80 模拟</p>
                  <p>地点 / 虚构城市观察馆</p>
                </div>
                <button onClick={() => go(5)}>阅读策展故事 ↗</button>
              </>
            )}
            {page === 3 && (
              <>
                <small>COLLECTION NOTES</small>
                <h1>从细节，进入故事。</h1>
                <p>以下为参考摄影的观察索引，不是真实馆藏清单。</p>
                <div className="museum-object-grid">
                  {shows.map((show, i) => (
                    <button
                      key={show.title}
                      onClick={() => patch({ object: i, page: 4 })}
                    >
                      {image(i)}
                      <span>OBSERVATION 0{i + 1}</span>
                      <h3>{show.title} / 观察卡</h3>
                    </button>
                  ))}
                </div>
              </>
            )}
            {page === 4 && (
              <>
                <div className="museum-exhibition">
                  {image(object)}
                  <div>
                    <small>OBJECT NOTE / 0{object + 1}</small>
                    <h1>{shows[object].title}的观察线索</h1>
                    <p>{shows[object].description}</p>
                    <dl>
                      <dt>记录方式</dt>
                      <dd>从可见细节出发，区分观察与推测。</dd>
                      <dt>来源</dt>
                      <dd>
                        {photos[object].credit} / {photos[object].license}
                      </dd>
                    </dl>
                    <a
                      href={photos[object].source}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      查看原始摄影来源 ↗
                    </a>
                    <button
                      className="museum-primary"
                      onClick={() => patch({ exhibition: object, page: 2 })}
                    >
                      查看关联展览
                    </button>
                  </div>
                </div>
              </>
            )}
            {page === 5 && (
              <>
                <small>CURATOR'S LETTER</small>
                <h1>收藏，是一种提问方式。</h1>
                <div className="museum-story">
                  {image(exhibition)}
                  <article>
                    <h2>我们如何选择一段故事？</h2>
                    <p>{current.description}</p>
                    <h2>让照片保留自己的边界。</h2>
                    <p>
                      一张图片展示的是一个视角，不是完整的历史。我们保留摄影来源，区分策展概念与真实展出事实，不把参考素材冒充场馆的现场记录。
                    </p>
                    <h2>邀请你参与观察。</h2>
                    <p>
                      参观时可以记录细节、提出疑问，也可以暂时不作结论。比起得到统一答案，我们更希望每个人知道自己的判断从何而来。
                    </p>
                    <button onClick={() => go(2)}>返回关联展览 →</button>
                  </article>
                </div>
              </>
            )}
            {page === 6 && (
              <>
                <small>WHAT'S ON / 示例活动</small>
                <h1>给周末，留一点好奇。</h1>
                <div className="museum-activities">
                  {["策展导览", "城市观察工作坊", "家庭器物故事会"].map(
                    (name, i) => (
                      <article key={name}>
                        <div className="museum-date">
                          <b>{21 + i}</b>
                          <span>NOV / 2026</span>
                        </div>
                        <div>
                          <small>
                            {
                              [
                                "60分钟 · 导览",
                                "90分钟 · 记录练习",
                                "45分钟 · 亲子讨论",
                              ][i]
                            }
                          </small>
                          <h2>{name}</h2>
                          <p>虚构活动信息 · 不对应真实主办方或已确认排期</p>
                        </div>
                        <button onClick={() => patch({ activity: i, page: 7 })}>
                          了解活动 ↗
                        </button>
                      </article>
                    ),
                  )}
                </div>
              </>
            )}
            {page === 7 && (
              <>
                <div className="museum-exhibition">
                  <div>
                    <small>PUBLIC PROGRAM / DEMO</small>
                    <h1>
                      {
                        ["策展导览", "城市观察工作坊", "家庭器物故事会"][
                          activity
                        ]
                      }
                    </h1>
                    <p>
                      {
                        [
                          "围绕展览叙事、摄影来源与观察方法展开。由概念讲解员带领参与者讨论三件参考材料，鼓励区分事实与解释。",
                          "使用简易观察卡记录空间、材料与行走感受。真实开展前须勘察路线、核实天气及取得必要拍摄同意。",
                          "从日常器物的用途与摆放开始，邀请家庭成员分享不同经验。儿童参与条件和监护安排需由真实组织者另行确认。",
                        ][activity]
                      }
                    </p>
                    <p>
                      本页介绍概念活动；下方进入展览入场预约演示，不预订活动名额。
                    </p>
                    <button
                      className="museum-primary"
                      onClick={() => {
                        patch({
                          exhibition: activity,
                          page: 8,
                          rescheduling: false,
                        });
                      }}
                    >
                      体验关联展览预约
                    </button>
                  </div>
                  {image(activity)}
                </div>
              </>
            )}
            {page === 8 && (
              <>
                <small>BOOK A VISIT / 01</small>
                <h1>选择一种参观方式。</h1>
                <p>
                  当前展览：{current.title}。价格与票种均为演示，不收取费用。
                </p>
                <div className="museum-ticket-types">
                  {ticketTypes.map((t, i) => (
                    <button
                      key={t.name}
                      aria-pressed={ticket === i}
                      onClick={() => patch({ ticket: i })}
                    >
                      <span>0{i + 1}</span>
                      <h2>{t.name}</h2>
                      <strong>¥{t.price}</strong>
                      <p>
                        {
                          [
                            "标准预约流程体验",
                            "不采集学生证等真实身份资料",
                            "免费流程与付费票同样可演示",
                          ][i]
                        }
                      </p>
                    </button>
                  ))}
                </div>
                <label className="museum-field">
                  预约人数
                  <select
                    aria-label="展馆预约人数"
                    value={s.quantity}
                    onChange={(e) =>
                      patch({ quantity: Number(e.target.value) })
                    }
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <button className="museum-primary" onClick={() => go(9)}>
                  选择预约日期 →
                </button>
              </>
            )}
            {page === 9 && (
              <>
                <small>BOOK A VISIT / 02</small>
                <h1>选一个从容的日子。</h1>
                <form
                  className="museum-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    go(10);
                  }}
                >
                  <label>
                    参观日期
                    <input
                      aria-label="展馆参观日期"
                      type="date"
                      required
                      min="2026-10-14"
                      value={s.date}
                      onChange={(e) => patch({ date: e.target.value })}
                    />
                  </label>
                  <p>日期选择仅用于原型。没有实时开馆安排或库存查询。</p>
                  <button className="museum-primary">选择入场场次 →</button>
                </form>
              </>
            )}
            {page === 10 && (
              <>
                <small>BOOK A VISIT / 03</small>
                <h1>为看展，留出一段时间。</h1>
                <p>{s.date} · 以下均为模拟场次，不代表真实余量。</p>
                <div className="museum-slots">
                  {slots.map((x, i) => (
                    <button
                      key={x}
                      aria-pressed={slot === i}
                      onClick={() => patch({ slot: i })}
                    >
                      <strong>{x}</strong>
                      <span>{slot === i ? "已选择" : "可选（模拟）"}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="museum-primary"
                  onClick={() => go(s.rescheduling ? 17 : 11)}
                >
                  {s.rescheduling ? "返回确认改期" : "填写访客信息 →"}
                </button>
              </>
            )}
            {page === 11 && (
              <>
                <small>BOOK A VISIT / 04</small>
                <h1>怎样称呼你？</h1>
                <form
                  className="museum-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    go(12);
                  }}
                >
                  <p>
                    请使用演示称呼与示例邮箱。不填写证件信息；不会发送邮件。
                  </p>
                  <label>
                    访客称呼
                    <input
                      aria-label="访客称呼"
                      required
                      maxLength={60}
                      value={s.name}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    示例邮箱
                    <input
                      aria-label="访客邮箱"
                      required
                      type="email"
                      maxLength={100}
                      value={s.email}
                      onChange={(e) => patch({ email: e.target.value })}
                    />
                  </label>
                  <button className="museum-primary">核对预约内容 →</button>
                </form>
              </>
            )}
            {page === 12 && (
              <>
                <small>BOOK A VISIT / REVIEW</small>
                <h1>最后核对一下。</h1>
                <div className="museum-review">
                  <div>
                    {image(exhibition)}
                    <h2>{current.title}</h2>
                    <p>
                      {s.date} / {slots[slot]}
                    </p>
                    <p>
                      {ticketTypes[ticket].name} × {s.quantity}人
                    </p>
                    <p>
                      {s.name || "尚未填写访客"} / {s.email || "尚未填写邮箱"}
                    </p>
                  </div>
                  <aside>
                    <small>演示合计 / 不收款</small>
                    <strong>¥ {total}</strong>
                    <button onClick={() => go(8)}>修改票种人数</button>
                    <button onClick={() => go(11)}>修改访客</button>
                    <button
                      className="museum-primary"
                      onClick={() => go(s.name && s.email ? 13 : 11)}
                    >
                      进入模拟预约
                    </button>
                  </aside>
                </div>
              </>
            )}
            {page === 13 && (
              <>
                <div className="museum-confirm">
                  <small>NO PAYMENT / NO ADMISSION</small>
                  <h1>这不是一张真实门票。</h1>
                  <p>
                    系统仅在当前浏览器保存演示预约，不占用名额，不向展馆发送资料。
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={s.agreed}
                      onChange={(e) => patch({ agreed: e.target.checked })}
                    />
                    我已了解这是模拟预约
                  </label>
                  <button
                    className="museum-primary"
                    disabled={
                      !s.agreed ||
                      !s.name.trim() ||
                      !/^\S+@\S+\.\S+$/.test(s.email)
                    }
                    onClick={reserve}
                  >
                    确认模拟预约
                  </button>
                  {(!s.name || !s.email) && (
                    <button onClick={() => go(11)}>先填写访客资料</button>
                  )}
                </div>
              </>
            )}
            {page === 14 && (
              <div className="museum-confirm">
                <span className="museum-success">{order ? "✓" : "—"}</span>
                <h1>{order ? "好奇心，已经有了位置。" : "还没有预约记录"}</h1>
                <p>
                  {order
                    ? "演示预约已保存在当前浏览器。以下凭证不具备入场效力。"
                    : "先浏览展览，再体验完整预约流程。"}
                </p>
                <button
                  className="museum-primary"
                  onClick={() => go(order ? 15 : 1)}
                >
                  {order ? "查看电子凭证" : "浏览展览"}
                </button>
              </div>
            )}
            {page === 15 && (
              <>
                <h1>电子凭证 / DEMO ONLY</h1>
                {order ? (
                  <div className="museum-pass">
                    <div>
                      <small>SHIGUANG MUSEUM</small>
                      <h2>{shows[order.exhibition].title}</h2>
                      <p>
                        {order.date} / {slots[order.slot]}
                      </p>
                      <p>
                        {order.name} · {order.quantity} 人
                      </p>
                      <b>{order.status}</b>
                    </div>
                    <aside>
                      <strong>非入场凭证</strong>
                      <code>{order.id}</code>
                      <p>
                        无可核销二维码
                        <br />
                        未产生真实交易
                      </p>
                      <button onClick={downloadOrder}>下载预约记录</button>
                    </aside>
                  </div>
                ) : (
                  <p>尚无演示凭证。请先完成预约。</p>
                )}
              </>
            )}
            {page === 16 && (
              <>
                <h1>我的预约</h1>
                <p>原型只保留最近一次演示预约；重新预约会替换本地记录。</p>
                {order ? (
                  <article className="museum-order">
                    {image(order.exhibition)}
                    <div>
                      <small>{order.id}</small>
                      <h2>{shows[order.exhibition].title}</h2>
                      <p>
                        {order.date} · {slots[order.slot]} · {order.quantity}人
                      </p>
                      <b>{order.status}</b>
                      <div>
                        <button onClick={() => go(15)}>查看凭证</button>
                        <button
                          onClick={() => {
                            patch({ page: 17, rescheduling: false });
                          }}
                        >
                          管理预约
                        </button>
                      </div>
                    </div>
                  </article>
                ) : (
                  <div className="museum-empty">
                    <p>还没有演示预约。</p>
                    <button onClick={() => go(1)}>选择一个展览 →</button>
                  </div>
                )}
              </>
            )}
            {page === 17 && (
              <>
                <h1>计划变了，也没关系。</h1>
                {order ? (
                  <div className="museum-manage">
                    <h2>{shows[order.exhibition].title}</h2>
                    <p>
                      当前：{order.date} / {slots[order.slot]} · {order.status}
                    </p>
                    {s.rescheduling && (
                      <p>
                        待确认改期：{s.date} / {slots[slot]}
                      </p>
                    )}
                    <button
                      disabled={order.status === "已取消（演示）"}
                      onClick={() =>
                        patch({
                          rescheduling: true,
                          date: order.date,
                          slot: order.slot,
                          page: 9,
                        })
                      }
                    >
                      选择新的参观日期
                    </button>
                    {s.rescheduling && order.status !== "已取消（演示）" && (
                      <button
                        className="museum-primary"
                        onClick={() => {
                          patch({
                            reservation: JSON.stringify({
                              ...order,
                              date: s.date,
                              slot,
                            }),
                            rescheduling: false,
                          });
                          msg("已更新本地演示预约日期。");
                        }}
                      >
                        确认改期
                      </button>
                    )}
                    <button
                      disabled={order.status === "已取消（演示）"}
                      onClick={() => {
                        patch({
                          reservation: JSON.stringify({
                            ...order,
                            status: "已取消（演示）",
                          }),
                          rescheduling: false,
                        });
                        msg("演示预约已取消，没有退款或商家通知。");
                      }}
                    >
                      取消演示预约
                    </button>
                    <p>
                      改期只更新原预约的日期与场次，不改变已登记票种、人数与金额。
                    </p>
                  </div>
                ) : (
                  <button onClick={() => go(1)}>尚无预约，浏览展览</button>
                )}
              </>
            )}
            {page === 18 && (
              <>
                <h1>下次想看的展览。</h1>
                {s.favorites.length ? (
                  cards(
                    shows
                      .map((show, id) => ({ ...show, id }))
                      .filter((show) => s.favorites.includes(show.id)),
                  )
                ) : (
                  <div className="museum-empty">
                    <p>收藏一个展览，为下一次探索留个记号。</p>
                    <button onClick={() => go(1)}>浏览展览 →</button>
                  </div>
                )}
              </>
            )}
            {page === 19 && (
              <>
                <h1>参观之前，先了解这些。</h1>
                <div className="museum-service">
                  <div>
                    {[
                      [
                        "这里有真实展览吗？",
                        "没有。作品是城市展馆预约原型，所有展览、票种与活动都是演示。",
                      ],
                      [
                        "是否提供真实无障碍设施？",
                        "原型不代表任何真实场馆。实际参观前，请向场馆核对入口、坡道、厕所与辅助服务。",
                      ],
                      [
                        "可以拍照或带儿童参加吗？",
                        "需以真实场馆的规则为准。这里的策展故事与摄影不构成现场许可。",
                      ],
                      [
                        "资料保存在什么地方？",
                        "仅当前浏览器。本地清理数据后会丢失；建议导出演示预约，不要填写真实敏感信息。",
                      ],
                    ].map(([q, a]) => (
                      <details key={q}>
                        <summary>{q}</summary>
                        <p>{a}</p>
                      </details>
                    ))}
                  </div>
                  <form
                    className="museum-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      msg("咨询内容已保存在本地，未发送给任何场馆。");
                    }}
                  >
                    <label>
                      咨询草稿
                      <textarea
                        aria-label="展馆咨询草稿"
                        required
                        maxLength={1000}
                        value={s.message}
                        onChange={(e) => patch({ message: e.target.value })}
                      />
                    </label>
                    <button className="museum-primary">保存咨询草稿</button>
                  </form>
                </div>
              </>
            )}
          </section>
        )}
        <footer className="museum-footer">
          <b>拾光 / SHIGUANG</b>
          <p>把日常，放进更长的时间里。</p>
          <button onClick={() => go(19)}>参观服务</button>
          <span>虚构展馆 · 真实参考摄影 · 非商业预约服务</span>
        </footer>
      </div>
      <Credits photos={photos} />
    </main>
  );
}
