import { useState } from "react";
import {
  copySample,
  Credits,
  download,
  Notice,
  SampleTop,
  travelPhotos as photos,
  useSampleState,
} from "./shared";
export const travelPages = [
  "首页",
  "目的地搜索",
  "目的地详情",
  "路线详情",
  "景点列表",
  "景点详情",
  "住宿列表",
  "住宿详情",
  "房型选择",
  "日期与余量",
  "行程编辑",
  "出行人信息",
  "订单确认",
  "模拟支付",
  "预订结果",
  "订单列表",
  "订单详情",
  "收藏夹",
  "旅行指南",
  "帮助与咨询",
];
const cities = ["托斯卡纳山城", "石街老城", "花园小镇"];
const attractions = ["山城花园", "公园雕塑", "教堂广场", "彩色巷道"];
const rooms = [
  { name: "庭院双人房", price: 680 },
  { name: "露台景观房", price: 920 },
  { name: "家庭套房", price: 1280 },
];
export type TravelState = {
  page: number;
  query: string;
  city: number;
  room: number;
  attraction: number;
  date: string;
  nights: number;
  guests: number;
  favorites: number[];
  stops: string[];
  name: string;
  email: string;
  coupon: string;
  paid: boolean;
  agreed: boolean;
  orderStatus: string;
  message: string;
};
const seed: TravelState = {
  page: 0,
  query: "",
  city: 0,
  room: 0,
  attraction: 0,
  date: "2026-11-12",
  nights: 2,
  guests: 2,
  favorites: [],
  stops: ["花园漫步", "街角咖啡", "古城日落"],
  name: "",
  email: "",
  coupon: "",
  paid: false,
  agreed: false,
  orderStatus: "未预订",
  message: "",
};
export function TravelCover() {
  return (
    <div className="travel-cover">
      <img src={photos[0].url} alt="山城花园" />
      <div>
        <small>ROAM / 慢游</small>
        <h2>
          把时间，
          <br />
          还给路上的风景。
        </h2>
        <span>走进托斯卡纳的日常 →</span>
      </div>
    </div>
  );
}
export default function TravelPrototype({ draftId }: { draftId?: string }) {
  const [s, set, error] = useSampleState("travel", draftId, seed);
  const [notice, msg] = useState("");
  const [newStop, stop] = useState("");
  const [filter, filt] = useState("全部");
  const [sort, sortBy] = useState("推荐");
  const patch = (x: Partial<TravelState>) => set((v) => ({ ...v, ...x }));
  const go = (page: number) => {
    patch({ page });
    msg("");
  };
  const page = Math.max(0, Math.min(19, s.page));
  const room = rooms[s.room] || rooms[0];
  const total = room.price * s.nights - (s.coupon === "ROAM100" ? 100 : 0);
  const favorite = (id: number) =>
    patch({
      favorites: s.favorites.includes(id)
        ? s.favorites.filter((x) => x !== id)
        : [...s.favorites, id],
    });
  const photo = (id: number, alt?: string) => (
    <img
      src={photos[id % photos.length].url}
      alt={alt || photos[id % photos.length].label}
    />
  );
  function copy() {
    try {
      copySample("travel", s);
    } catch {
      msg("无法保存副本，请导出行程备份。");
    }
  }
  const listing = (stay = false) => (
    <div className="roam-listings">
      {cities
        .map((city, id) => ({ city, id }))
        .filter((x) => x.city.includes(s.query.trim()))
        .sort((a, b) => (sort === "价格从低到高" ? a.id - b.id : b.id - a.id))
        .map(({ city, id }) => (
          <article key={city}>
            {photo(id + 4)}
            <button
              className="roam-heart"
              aria-label={`收藏${city}`}
              aria-pressed={s.favorites.includes(id)}
              onClick={() => favorite(id)}
            >
              {s.favorites.includes(id) ? "♥" : "♡"}
            </button>
            <small>{stay ? "精品住宿 · 目的地实拍" : "慢旅行 · 2–4 天"}</small>
            <h3>{stay ? city + "花园旅居" : city}</h3>
            <p>
              {stay
                ? `¥ ${680 + id * 120} 起 / 晚 · 房型以演示资料为准`
                : "花园、古街与当地生活，在不赶路的日子里慢慢发现。"}
            </p>
            <button
              onClick={() => {
                patch({ city: id, page: stay ? 7 : 2 });
              }}
            >
              查看{stay ? "住宿" : "目的地"} →
            </button>
          </article>
        ))}
    </div>
  );
  return (
    <main className="sample-view travel-view">
      <SampleTop
        type="可交互网站原型 · 20 个业务页面"
        title="慢游旅行"
        draftId={draftId}
        onCopy={copy}
      >
        <button
          onClick={() =>
            download(
              new Blob([JSON.stringify(s, null, 2)], {
                type: "application/json",
              }),
              "慢游-行程.json",
            )
          }
        >
          导出行程
        </button>
      </SampleTop>
      <Notice text={error || notice} />
      <div className="prototype-switch">
        <span>原型预览 · 不会真实预订或扣款</span>
        <label>
          浏览业务页面
          <select
            aria-label="浏览业务页面"
            value={page}
            onChange={(e) => go(Number(e.target.value))}
          >
            {travelPages.map((name, i) => (
              <option key={name} value={i}>
                {String(i + 1).padStart(2, "0")} / {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="roam-site" data-travel-page={page}>
        <header className="roam-nav">
          <button className="roam-brand" onClick={() => go(0)}>
            roam<span>慢 游</span>
          </button>
          <nav aria-label="慢游网站导航">
            {[
              [0, "首页"],
              [1, "目的地"],
              [6, "找住宿"],
              [10, "我的行程"],
              [15, "订单"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-current={page === id ? "page" : undefined}
                onClick={() => go(Number(id))}
              >
                {label}
              </button>
            ))}
          </nav>
          <button aria-label="查看收藏" onClick={() => go(17)}>
            ♡ {s.favorites.length}
          </button>
        </header>
        {page === 0 ? (
          <>
            <section className="roam-hero">
              <TravelCover />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  go(1);
                }}
              >
                <label>
                  想去哪里？
                  <input
                    aria-label="目的地关键词"
                    placeholder="搜索山城、老城或花园"
                    value={s.query}
                    onChange={(e) => patch({ query: e.target.value })}
                  />
                </label>
                <label>
                  出发日期
                  <input
                    type="date"
                    value={s.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                </label>
                <button>寻找一段慢时光 ↗</button>
              </form>
            </section>
            <section className="roam-section">
              <small>GO SLOW. FEEL MORE.</small>
              <h2>不是去过，而是生活过。</h2>
              {listing()}
            </section>
          </>
        ) : (
          <section className="roam-section">
            <div className="roam-breadcrumb">
              <button onClick={() => go(0)}>慢游首页</button>
              <span>/ {travelPages[page]}</span>
            </div>
            {page === 1 && (
              <>
                <h1>找到下一段慢时光</h1>
                <div className="roam-toolbar">
                  <input
                    aria-label="搜索目的地"
                    value={s.query}
                    onChange={(e) => patch({ query: e.target.value })}
                    placeholder="搜索目的地"
                  />
                  <select
                    aria-label="目的地排序"
                    value={sort}
                    onChange={(e) => sortBy(e.target.value)}
                  >
                    <option>推荐</option>
                    <option>价格从低到高</option>
                  </select>
                </div>
                {listing()}
                {!cities.some((city) => city.includes(s.query.trim())) && (
                  <p>没有匹配的目的地，试试“山城”。</p>
                )}
              </>
            )}
            {page === 2 && (
              <>
                <div className="roam-split">
                  <div>
                    <small>DESTINATION / TUSCANY</small>
                    <h1>{cities[s.city]}</h1>
                    <p>
                      在石墙和花园之间散步，在午后的广场停下来。用三天，认识一座小城的日常。
                    </p>
                    <div className="roam-tags">
                      <span>适合步行</span>
                      <span>自然与人文</span>
                      <span>演示目的地</span>
                    </div>
                    <button className="roam-primary" onClick={() => go(3)}>
                      查看 3 日路线
                    </button>
                    <button onClick={() => favorite(s.city)}>
                      {s.favorites.includes(s.city)
                        ? "已收藏 ♥"
                        : "收藏目的地 ♡"}
                    </button>
                  </div>
                  {photo(s.city)}
                </div>
                <div className="roam-photo-row">
                  {[1, 3, 7].map((id) => (
                    <button key={id} onClick={() => go(4)}>
                      {photo(id)}
                    </button>
                  ))}
                </div>
              </>
            )}
            {page === 3 && (
              <>
                <h1>三日之间，看见日常。</h1>
                <div className="roam-route">
                  {["抵达与花园", "石街与手作", "广场与告别"].map((name, i) => (
                    <article key={name}>
                      <b>DAY 0{i + 1}</b>
                      {photo(i + 1)}
                      <h3>{name}</h3>
                      <p>
                        {
                          [
                            "抵达旅居，步行前往山城花园，在树荫下读一本书。",
                            "沿石街寻找小店，预留一整个午后给当地的手工作坊。",
                            "在广场吃早餐，回望喜欢的角落，带着自己的节奏离开。",
                          ][i]
                        }
                      </p>
                      <button
                        onClick={() => {
                          patch({ stops: [...s.stops, name].slice(0, 12) });
                          msg("已加入我的行程。");
                        }}
                      >
                        加入行程
                      </button>
                    </article>
                  ))}
                </div>
                <button className="roam-primary" onClick={() => go(10)}>
                  编辑我的行程 →
                </button>
              </>
            )}
            {page === 4 && (
              <>
                <h1>值得绕路的小地方</h1>
                <div className="roam-toolbar">
                  {["全部", "自然", "人文"].map((x) => (
                    <button
                      aria-pressed={filter === x}
                      key={x}
                      onClick={() => filt(x)}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                <div className="roam-listings">
                  {attractions
                    .map((name, id) => ({ name, id }))
                    .filter(
                      ({ id }) =>
                        filter === "全部" ||
                        (filter === "自然" ? id < 2 : id >= 2),
                    )
                    .map(({ name, id }) => (
                      <article key={name}>
                        {photo(id + 1)}
                        <h3>{name}</h3>
                        <button
                          onClick={() => {
                            patch({ page: 5, attraction: id });
                            msg("");
                          }}
                        >
                          探索地点 ↗
                        </button>
                      </article>
                    ))}
                </div>
              </>
            )}
            {page === 5 && (
              <>
                <div className="roam-split">
                  {photo(s.attraction + 1)}
                  <div>
                    <small>A SMALL PLACE, A LONG AFTERNOON</small>
                    <h1>{attractions[s.attraction]}</h1>
                    <p>
                      建议游览 60–90
                      分钟。步行进入，轻声交谈，不打扰这座花园原本的生活。
                    </p>
                    <dl>
                      <dt>开放时间（演示）</dt>
                      <dd>09:00–18:00</dd>
                      <dt>出行建议</dt>
                      <dd>舒适鞋履、饮用水、防晒。</dd>
                    </dl>
                    <button
                      className="roam-primary"
                      onClick={() => {
                        patch({
                          stops: [...s.stops, attractions[s.attraction]].slice(
                            0,
                            12,
                          ),
                        });
                        msg("景点已加入行程。");
                      }}
                    >
                      加入我的行程
                    </button>
                  </div>
                </div>
              </>
            )}
            {page === 6 && (
              <>
                <h1>住进风景，也住进日常。</h1>
                <p>
                  以下旅居名称、价格和房型是原型演示数据；照片为目的地实拍，不代表真实住宿设施。
                </p>
                <div className="roam-toolbar">
                  <input
                    aria-label="搜索住宿"
                    value={s.query}
                    onChange={(e) => patch({ query: e.target.value })}
                    placeholder="按目的地寻找住宿"
                  />
                  <button
                    onClick={() =>
                      sortBy(sort === "推荐" ? "价格从低到高" : "推荐")
                    }
                  >
                    {sort}
                  </button>
                </div>
                {listing(true)}
              </>
            )}
            {page === 7 && (
              <>
                <div className="roam-stay-hero">
                  {photo(s.city + 4)}
                  <div>
                    <small>GARDEN STAY / DEMO</small>
                    <h1>{cities[s.city]}花园旅居</h1>
                    <p>安静庭院 · 步行探索 · 从容早餐</p>
                  </div>
                </div>
                <div className="roam-split">
                  <div>
                    <h2>像当地人一样住几天</h2>
                    <p>
                      这是一个虚构住宿的预订原型。这里没有真实库存或入住承诺，但可以完整体验从选房到订单的交互流程。
                    </p>
                    <details>
                      <summary>设施与入住须知</summary>
                      <p>
                        演示设施：早餐、行李寄存、无线网络。入住时间
                        15:00，退房时间 11:00。
                      </p>
                    </details>
                  </div>
                  <aside className="roam-book-box">
                    <strong>
                      ¥ {room.price} <small>/ 晚起</small>
                    </strong>
                    <p>2 位住客 · 不含真实交易</p>
                    <button className="roam-primary" onClick={() => go(8)}>
                      选择喜欢的房型
                    </button>
                  </aside>
                </div>
              </>
            )}
            {page === 8 && (
              <>
                <h1>给自己留一扇看风景的窗。</h1>
                <div className="roam-room-list">
                  {rooms.map((r, i) => (
                    <article key={r.name}>
                      {photo(i + 5)}
                      <div>
                        <small>目的地参考照片 · 非客房实拍</small>
                        <h3>{r.name}</h3>
                        <p>
                          {i === 2
                            ? "45 m² · 两间卧室 · 适合家庭"
                            : "28 m² · 双人床 · 独立卫浴"}
                        </p>
                        <strong>¥ {r.price} / 晚</strong>
                      </div>
                      <button
                        aria-pressed={s.room === i}
                        onClick={() => patch({ room: i })}
                      >
                        {s.room === i ? "已选择" : "选择房型"}
                      </button>
                    </article>
                  ))}
                </div>
                <button className="roam-primary" onClick={() => go(9)}>
                  选择日期 →
                </button>
              </>
            )}
            {page === 9 && (
              <>
                <h1>把日历里的一格，留给旅行。</h1>
                <div className="roam-split">
                  <form
                    className="roam-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      go(11);
                    }}
                  >
                    <label>
                      入住日期
                      <input
                        required
                        type="date"
                        min="2026-10-14"
                        value={s.date}
                        onChange={(e) => patch({ date: e.target.value })}
                      />
                    </label>
                    <label>
                      入住晚数
                      <input
                        aria-label="入住晚数"
                        type="number"
                        min="1"
                        max="30"
                        required
                        value={s.nights}
                        onChange={(e) =>
                          patch({
                            nights: Math.max(
                              1,
                              Math.min(30, Number(e.target.value)),
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      人数
                      <select
                        value={s.guests}
                        onChange={(e) =>
                          patch({ guests: Number(e.target.value) })
                        }
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n} 位
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="roam-primary">填写出行人</button>
                  </form>
                  <aside className="roam-book-box">
                    {photo(6)}
                    <h3>{room.name}</h3>
                    <p>
                      {s.date} / {s.nights} 晚 / {s.guests} 位
                    </p>
                    <strong>¥ {room.price * s.nights}</strong>
                    <p>可选日期均为模拟余量，没有查询真实库存。</p>
                  </aside>
                </div>
              </>
            )}
            {page === 10 && (
              <>
                <h1>行程不必很满，喜欢就够了。</h1>
                <div className="roam-itinerary">
                  {s.stops.map((name, i) => (
                    <article key={`${i}-${name}`}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <h3>{name}</h3>
                      <button
                        aria-label={`上移${name}`}
                        disabled={!i}
                        onClick={() => {
                          const next = [...s.stops];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          patch({ stops: next });
                        }}
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`删除${name}`}
                        onClick={() =>
                          patch({ stops: s.stops.filter((_, n) => n !== i) })
                        }
                      >
                        删除
                      </button>
                    </article>
                  ))}
                </div>
                <form
                  className="roam-toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newStop.trim()) {
                      patch({
                        stops: [...s.stops, newStop.trim()].slice(0, 12),
                      });
                      stop("");
                    }
                  }}
                >
                  <input
                    aria-label="新行程地点"
                    required
                    maxLength={60}
                    value={newStop}
                    onChange={(e) => stop(e.target.value)}
                    placeholder="加一个想去的地方"
                  />
                  <button disabled={s.stops.length >= 12}>加入行程</button>
                </form>
                <button onClick={() => go(6)}>寻找附近住宿 →</button>
              </>
            )}
            {page === 11 && (
              <>
                <h1>告诉我们，谁要出发。</h1>
                <form
                  className="roam-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    go(12);
                  }}
                >
                  <p>
                    仅保存到此浏览器，请使用演示信息，不要填写证件或真实敏感数据。
                  </p>
                  <label>
                    出行人称呼
                    <input
                      aria-label="出行人称呼"
                      required
                      maxLength={60}
                      value={s.name}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    联系邮箱
                    <input
                      aria-label="联系邮箱"
                      type="email"
                      required
                      maxLength={120}
                      value={s.email}
                      onChange={(e) => patch({ email: e.target.value })}
                    />
                  </label>
                  <button className="roam-primary">确认出行信息</button>
                </form>
              </>
            )}
            {page === 12 && (
              <>
                <h1>出发之前，再确认一次。</h1>
                <div className="roam-split">
                  <div className="roam-summary">
                    <h3>{cities[s.city]}花园旅居</h3>
                    <p>
                      {room.name} · {s.guests} 位 · {s.date} 入住
                    </p>
                    <p>
                      {s.name || "尚未填写出行人"} / {s.email || "尚未填写邮箱"}
                    </p>
                    <button onClick={() => go(11)}>修改出行人</button>
                    <details>
                      <summary>查看取消政策</summary>
                      <p>
                        此订单为演示，可在订单详情里取消，不产生费用或退款。
                      </p>
                    </details>
                  </div>
                  <aside className="roam-book-box">
                    <p>
                      ¥ {room.price} × {s.nights} 晚
                    </p>
                    <label>
                      体验优惠码
                      <input
                        aria-label="体验优惠码"
                        placeholder="试试 ROAM100"
                        maxLength={20}
                        value={s.coupon}
                        onChange={(e) =>
                          patch({ coupon: e.target.value.toUpperCase() })
                        }
                      />
                    </label>
                    <p>
                      {s.coupon === "ROAM100"
                        ? "演示优惠 −¥100"
                        : "优惠码仅用于测算"}
                    </p>
                    <strong>合计 ¥ {total}</strong>
                    <button
                      className="roam-primary"
                      onClick={() => (s.name && s.email ? go(13) : go(11))}
                    >
                      继续模拟支付
                    </button>
                  </aside>
                </div>
              </>
            )}
            {page === 13 && (
              <>
                <div className="roam-payment">
                  <small>SIMULATION ONLY</small>
                  <h1>支付演示，不会扣款。</h1>
                  <p>不会收集银行卡号，也不会调用支付服务。</p>
                  <strong>¥ {total}</strong>
                  <label>
                    <input
                      type="checkbox"
                      checked={s.agreed}
                      onChange={(e) => patch({ agreed: e.target.checked })}
                    />
                    我了解这是本地模拟预订
                  </label>
                  <button
                    className="roam-primary"
                    disabled={!s.agreed || !s.name || !s.email}
                    onClick={() =>
                      patch({
                        paid: true,
                        orderStatus: "已确认（演示）",
                        page: 14,
                      })
                    }
                  >
                    确认模拟预订
                  </button>
                  {(!s.name || !s.email) && (
                    <button onClick={() => go(11)}>先填写出行人</button>
                  )}
                </div>
              </>
            )}
            {page === 14 && (
              <div className="roam-confirm">
                <span>✓</span>
                <h1>
                  {s.paid ? "一段慢时光，已放进行程。" : "还没有确认预订"}
                </h1>
                <p>
                  {s.paid
                    ? "已在此浏览器创建演示订单；未付款、未联系住宿方。"
                    : "请先选择住宿并完成模拟预订。"}
                </p>
                <button
                  className="roam-primary"
                  onClick={() => go(s.paid ? 16 : 6)}
                >
                  {s.paid ? "查看我的订单" : "开始选住宿"}
                </button>
              </div>
            )}
            {page === 15 && (
              <>
                <h1>你的下一次出发</h1>
                {s.paid ? (
                  <article className="roam-order-card">
                    {photo(4)}
                    <div>
                      <small>ROAM-DEMO-001</small>
                      <h3>{cities[s.city]}花园旅居</h3>
                      <p>
                        {s.date} / {s.nights} 晚 · {s.orderStatus}
                      </p>
                      <button onClick={() => go(16)}>查看订单 →</button>
                    </div>
                  </article>
                ) : (
                  <div className="roam-empty">
                    <h3>还没有演示订单</h3>
                    <button onClick={() => go(6)}>去寻找住宿</button>
                  </div>
                )}
              </>
            )}
            {page === 16 && (
              <>
                <h1>订单详情</h1>
                {s.paid ? (
                  <div className="roam-order-detail">
                    <small>ROAM-DEMO-001 · {s.orderStatus}</small>
                    <h2>{cities[s.city]}花园旅居</h2>
                    <dl>
                      <dt>房型</dt>
                      <dd>{room.name}</dd>
                      <dt>日期</dt>
                      <dd>
                        {s.date} / {s.nights} 晚
                      </dd>
                      <dt>出行人</dt>
                      <dd>{s.name}</dd>
                      <dt>演示金额</dt>
                      <dd>¥ {total}</dd>
                    </dl>
                    <button
                      disabled={s.orderStatus === "已取消（演示）"}
                      onClick={() => patch({ orderStatus: "已取消（演示）" })}
                    >
                      取消演示订单
                    </button>
                    <button onClick={() => go(19)}>咨询订单</button>
                  </div>
                ) : (
                  <button onClick={() => go(6)}>尚无订单，去选住宿</button>
                )}
              </>
            )}
            {page === 17 && (
              <>
                <h1>留给下次的风景</h1>
                {!s.favorites.length ? (
                  <div className="roam-empty">
                    <p>在目的地卡片上点爱心，收藏想去的地方。</p>
                    <button onClick={() => go(1)}>探索目的地</button>
                  </div>
                ) : (
                  <div className="roam-listings">
                    {s.favorites.map((id) => (
                      <article key={id}>
                        {photo(id + 4)}
                        <h3>{cities[id]}</h3>
                        <button
                          onClick={() => {
                            patch({ city: id, page: 2 });
                          }}
                        >
                          查看目的地
                        </button>
                        <button onClick={() => favorite(id)}>取消收藏</button>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
            {page === 18 && (
              <>
                <small>ROAM JOURNAL / ISSUE 01</small>
                <h1>给第一次慢旅行的人。</h1>
                <div className="roam-guide">
                  {photo(8)}
                  <article>
                    <h2>少一点目的地，多一点停留。</h2>
                    <p>
                      出发前先选一个真正想住下来的地方。把路线缩短，给天气、偶遇与临时起意留下空间。
                    </p>
                    {["行李如何精简", "如何在当地步行", "怎样记录旅途"].map(
                      (name, i) => (
                        <details key={name}>
                          <summary>{name}</summary>
                          <p>
                            {
                              [
                                "只带适合多种天气的基础衣物，留出随手整理的余地。",
                                "提前观察公共交通和步行路线，确认无障碍条件并尊重当地规则。",
                                "记下一段对话、一种气味或一道光，不必让每一次观察都变成任务。",
                              ][i]
                            }
                          </p>
                        </details>
                      ),
                    )}
                  </article>
                </div>
              </>
            )}
            {page === 19 && (
              <>
                <h1>需要一点出发前的帮助？</h1>
                <div className="roam-split">
                  <div>
                    {[
                      "这是一个真实预订网站吗？",
                      "我的资料存在哪里？",
                      "可以取消订单吗？",
                    ].map((x, i) => (
                      <details key={x}>
                        <summary>{x}</summary>
                        <p>
                          {
                            [
                              "不是。这是完整交互原型，不会联系商家或收取款项。",
                              "仅保存在当前浏览器。请使用演示信息。",
                              "可以在订单详情里取消本地演示订单，不涉及退款。",
                            ][i]
                          }
                        </p>
                      </details>
                    ))}
                  </div>
                  <form
                    className="roam-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      msg("咨询草稿已保存在本地，没有发送给客服。");
                    }}
                  >
                    <label>
                      咨询内容
                      <textarea
                        aria-label="咨询内容"
                        required
                        maxLength={1000}
                        value={s.message}
                        onChange={(e) => patch({ message: e.target.value })}
                      />
                    </label>
                    <button className="roam-primary">保存咨询草稿</button>
                  </form>
                </div>
              </>
            )}
          </section>
        )}
        <footer className="roam-footer">
          <span>roam / 把时间还给风景</span>
          <button onClick={() => go(18)}>旅行指南</button>
          <button onClick={() => go(19)}>帮助与咨询</button>
          <small>虚构品牌与预订数据 · 真实目的地摄影仅作参考</small>
        </footer>
      </div>
      <Credits photos={photos} />
    </main>
  );
}
