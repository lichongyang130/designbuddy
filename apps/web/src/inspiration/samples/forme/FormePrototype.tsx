import { useRef, useState, type ReactNode } from "react";
import {
  SampleTop,
  Notice,
  copySample,
  download,
  dataUrl,
  useSampleState,
} from "../shared";
import { escapeHtml, csvValue } from "../media-utils";
import {
  images,
  pages,
  products,
  initial,
  price,
  variant,
  total,
  shipping,
  money,
  restoreForme,
  type FormeState,
  type Line,
} from "./data";
import "./forme.css";

const checkLabels = [
  "外箱与封条完整",
  "核对数量与配置",
  "检查表面与边角",
  "核对五金与附件",
  "确认摆放与稳定性",
  "记录需要咨询的问题",
];
const materialInfo = [
  {
    name: "木与时间",
    tag: "01 / WOOD",
    image: images.chair,
    text: "胡桃木的深色与橡木的浅色，为空间建立不同的温度。木纹图像仅为概念参考，选配不会实时重绘产品照片。",
    care: "使用拧干的软布顺纹擦拭，避免长期暴晒与热杯直接接触。",
  },
  {
    name: "触感与织物",
    tag: "02 / TEXTILE",
    image: images.sofa,
    text: "亚麻适合偏干爽的触感；羊毛混纺更强调蓬松。示例价格差为每件 300 元，不代表真实面料性能或库存。",
    care: "先吸除表面浮尘。清洁前查看实物洗护标签，在隐蔽处试用清洁剂。",
  },
  {
    name: "石与留白",
    tag: "03 / STONE",
    image: images.table,
    text: "洞石孔隙和纹理的差异，是选板时需要认真查看的部分。展示图不代表实际封护处理与耐污等级。",
    care: "及时吸干液体，使用隔热垫；避免酸性、强碱性清洁剂和研磨材料。",
  },
];
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? Math.round(n) : min));
type Version = { name: string; at: string; state: FormeState };

export default function FormePrototype({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("forme", draftId, initial);
  const [notice, msg] = useState(""),
    [care, setCare] = useState(0),
    [layoutItem, setLayoutItem] = useState(0),
    [versionName, setVersionName] = useState(""),
    [exporting, setExporting] = useState(false);
  const dragStart = useRef<FormeState | null>(null);
  const undo = useRef<FormeState[]>([]),
    redo = useRef<FormeState[]>([]);
  const versionKey = `designbuddy.forme.versions.${draftId || "sample"}`;
  const [versions, setVersions] = useState<Version[]>(() => {
    try {
      const raw = localStorage.getItem(versionKey);
      if (!raw || raw.length > 500000) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v)
        ? v
            .filter(
              (x) =>
                x && typeof x.name === "string" && typeof x.at === "string",
            )
            .slice(0, 6)
            .map((x) => ({
              name: x.name.slice(0, 40),
              at: x.at,
              state: restoreForme(x.state),
            }))
        : [];
    } catch {
      return [];
    }
  });
  const update = (patch: Partial<FormeState>, record = true) => {
    if (record) {
      undo.current = [...undo.current, state].slice(-40);
      redo.current = [];
    }
    set({ ...state, ...patch });
    msg("");
  };
  const go = (page: number) => update({ page }, false);
  const p = products[state.selected],
    subtotal = state.cart.reduce((a, l) => a + price(l) * l.qty, 0),
    grand = total(state);
  const selectedLine: Line = {
    product: state.selected,
    finish: state.finish,
    fabric: state.fabric,
    qty: state.quantity,
  };
  const toggleFavorite = (i: number) =>
    update({
      favorites: state.favorites.includes(i)
        ? state.favorites.filter((n) => n !== i)
        : [...state.favorites, i],
    });
  const add = (line: Line, cart = state.cart) => {
    const at = cart.findIndex(
      (l) =>
        l.product === line.product &&
        l.finish === line.finish &&
        l.fabric === line.fabric,
    );
    return at < 0
      ? [...cart, { ...line }]
      : cart.map((l, i) =>
          i === at ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l,
        );
  };
  const addCurrent = () => {
    update({ cart: add(selectedLine) });
    msg("已加入采购清单，数量上限为每个配置 20 件。");
  };
  const customerValid =
    state.client.trim().length > 0 &&
    state.address.trim().length >= 5 &&
    (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contact.trim()) ||
      /^\+?[\d\s-]{7,20}$/.test(state.contact.trim()));
  const ready = state.cart.length > 0 && customerValid && state.agreed;
  const img = (src: string, alt: string, cls = "") => (
    <img className={cls} src={src} alt={alt} loading="lazy" />
  );
  const heading = (tag: string, title: string, body?: string) => (
    <header className="fm-heading">
      <small>{tag}</small>
      <h1>{title}</h1>
      {body && <p>{body}</p>}
    </header>
  );
  const field = (
    label: string,
    key:
      | "project"
      | "client"
      | "contact"
      | "address"
      | "notes"
      | "serviceNote"
      | "consultBrief",
    area = false,
  ) => (
    <label className="fm-field">
      {label}
      {area ? (
        <textarea
          aria-label={label}
          value={state[key]}
          maxLength={1200}
          onChange={(e) => update({ [key]: e.target.value })}
        />
      ) : (
        <input
          aria-label={label}
          value={state[key]}
          maxLength={key === "address" ? 200 : 80}
          onChange={(e) => update({ [key]: e.target.value })}
        />
      )}
    </label>
  );
  const card = (i: number) => {
    const x = products[i];
    return (
      <article className="fm-product" key={i}>
        <button
          className="fm-photo-button"
          onClick={() => update({ selected: i, page: 3 }, false)}
          aria-label={`查看${x.name}`}
        >
          {img(x.image, x.name)}
          <span>EXPLORE ↗</span>
        </button>
        <div>
          <small>{x.en}</small>
          <button onClick={() => update({ selected: i, page: 3 }, false)}>
            <h3>{x.name}</h3>
          </button>
          <p>
            {x.material}
            <b>{money(x.price)}</b>
          </p>
          <button
            className="fm-text-button"
            aria-pressed={state.favorites.includes(i)}
            onClick={() => toggleFavorite(i)}
          >
            {state.favorites.includes(i) ? "已收藏 −" : "收藏 +"}
          </button>
        </div>
      </article>
    );
  };
  const empty = (text: string, button = "浏览家具", to = 1) => (
    <div className="fm-empty">
      <span>FORME / YOUR SPACE</span>
      <h2>{text}</h2>
      <p>从需要的物件开始，不必一次填满房间。</p>
      <button onClick={() => go(to)}>{button} ↗</button>
    </div>
  );
  const lineTable = (lines: Line[], editable = false) => (
    <div className="fm-table-wrap">
      <table>
        <thead>
          <tr>
            <th>物件 / 配置</th>
            <th>单价</th>
            <th>数量</th>
            <th>小计</th>
            {editable && <th>操作</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={`${l.product}-${l.finish}-${l.fabric}-${i}`}>
              <td>
                <div className="fm-line-product">
                  {img(products[l.product].image, products[l.product].name)}
                  <span>
                    <b>{products[l.product].name}</b>
                    <small>{variant(l)}</small>
                  </span>
                </div>
              </td>
              <td>{money(price(l))}</td>
              <td>
                {editable ? (
                  <input
                    type="number"
                    min={1}
                    max={20}
                    aria-label={`清单第${i + 1}项数量`}
                    value={l.qty}
                    onChange={(e) =>
                      update({
                        cart: state.cart.map((x, n) =>
                          n === i
                            ? { ...x, qty: clamp(+e.target.value, 1, 20) }
                            : x,
                        ),
                      })
                    }
                  />
                ) : (
                  l.qty
                )}
              </td>
              <td>{money(price(l) * l.qty)}</td>
              {editable && (
                <td>
                  <button
                    aria-label={`移除清单第${i + 1}项`}
                    onClick={() =>
                      update({ cart: state.cart.filter((_, n) => n !== i) })
                    }
                  >
                    移除
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const saveJson = (name: string, value: unknown) =>
    download(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
      name,
    );
  const saveCSV = () =>
    download(
      new Blob(
        [
          "\ufeff" +
            [
              ["项目", state.project],
              ["产品", "配置", "数量", "单价", "小计"],
              ...state.cart.map((l) => [
                products[l.product].name,
                variant(l),
                l.qty,
                price(l),
                price(l) * l.qty,
              ]),
              ["配送", state.cart.length ? shipping(state.delivery) : 0],
              ["组装", state.cart.length && state.assembly ? 360 : 0],
              ["合计", grand],
              ["说明", "概念产品与示例价格，非合同或付款凭据"],
            ]
              .map((r) => r.map(csvValue).join(","))
              .join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      "forme-estimate.csv",
    );
  const exportHTML = async () => {
    setExporting(true);
    try {
      const assets = await Promise.all(
        [images.room, ...products.map((p) => p.image)].map(dataUrl),
      );
      const rows = state.cart
        .map(
          (l) =>
            `<tr><td><img src="${assets[l.product + 1]}" alt="">${escapeHtml(products[l.product].name)}<small>${escapeHtml(variant(l))}</small></td><td>${l.qty}</td><td>${money(price(l))}</td><td>${money(price(l) * l.qty)}</td></tr>`,
        )
        .join("");
      const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(state.project)} / FORME</title><style>body{max-width:1000px;margin:40px auto;padding:24px;background:#f5f2ec;color:#302d27;font:16px/1.8 'Noto Sans SC',system-ui}header img{width:100%;max-height:450px;object-fit:cover}h1{font-size:42px}table{width:100%;border-collapse:collapse}td,th{padding:16px;text-align:left;border-bottom:1px solid #ccc}td img{width:90px;vertical-align:middle;margin-right:12px}small{display:block;color:#726d61}.table{overflow:auto}strong{font-size:26px}button{font:inherit;padding:10px 20px}p{white-space:pre-wrap}@media print{button{display:none}tr{break-inside:avoid}}</style><header><small>FORME / PROJECT EDITION</small><h1>${escapeHtml(state.project)}</h1><img src="${assets[0]}" alt="AI生成的概念客厅"></header><h2>空间方向</h2><p>${escapeHtml(state.notes)}</p><p>空间 ${state.roomWidth} × ${state.roomDepth} cm · 预算 ${money(state.budget)}</p><div class="table"><table><thead><tr><th>物件 / 配置</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>${rows}</tbody></table></div><p>配送 ${money(state.cart.length ? shipping(state.delivery) : 0)} · 组装 ${money(state.cart.length && state.assembly ? 360 : 0)}</p><strong>项目预估 ${money(grand)}</strong><h2>交付联系</h2><p>${escapeHtml(state.client)}\n${escapeHtml(state.contact)}\n${escapeHtml(state.address)}</p><button onclick="window.print()">打印 / 另存 PDF</button><p>本文件是当前项目的独立方案快照，图片已嵌入，可离线查看；不是整个原型的源码。图片为本项目生成的 AI 概念图，不是可购买商品或真实客户案例。品牌、尺寸、价格和交付政策均为演示数据；不是合同、发票或付款凭据。未上传、未发送。</p></html>`;
      const { embeddedFontStyle } = await import(
        "../../../components/scene-demos/fonts"
      );
      const fonts = (
        await embeddedFontStyle(html.replace(/data:image\/[^"]+/g, ""))
      )
        .replace("<metadata>", "<div hidden data-font-license>")
        .replace("</metadata>", "</div>");
      download(
        new Blob([html.replace("</html>", fonts + "</html>")], {
          type: "text/html;charset=utf-8",
        }),
        "forme-project.html",
      );
      msg("已导出含图片的独立方案 HTML。");
    } catch {
      msg("素材读取或导出失败，请重试。");
    } finally {
      setExporting(false);
    }
  };
  const saveVersion = () => {
    if (!versionName.trim()) {
      msg("请先为版本命名。");
      return;
    }
    const next = [
      {
        name: versionName.trim().slice(0, 40),
        at: new Date().toISOString(),
        state: structuredClone(state),
      },
      ...versions,
    ].slice(0, 6);
    try {
      localStorage.setItem(versionKey, JSON.stringify(next));
      setVersions(next);
      setVersionName("");
      msg("版本已保存在当前浏览器。");
    } catch {
      msg("版本保存失败，请导出项目备份。");
    }
  };
  let content: ReactNode;
  switch (state.page) {
    case 0:
      content = (
        <>
          <section className="fm-hero">
            {img(images.room, "自然光下的概念客厅")}
            <div>
              <small>FORME / THE QUIET COLLECTION</small>
              <h1>
                把日常，
                <br />
                安放得更好。
              </h1>
              <p>
                不急着填满空间。
                <br />
                先找到，值得相处的物件。
              </p>
              <button onClick={() => go(1)}>探索日常物件 ↗</button>
            </div>
            <span>01 / LIVING WITH INTENTION</span>
          </section>
          <div className="fm-intro">
            <small>LESS, BUT CONSIDERED.</small>
            <h2>
              从一把椅子，
              <br />
              到一个自己的角落。
            </h2>
            <p>
              四件物件，三种触感。一套从选品到交付的空间采购原型。配置、预算和清单都由你决定。
            </p>
          </div>
          <div className="fm-product-grid">{[0, 1].map(card)}</div>
          <button className="fm-wide-link" onClick={() => go(6)}>
            先量好空间，再决定添置什么 <span>进入空间布局 ↗</span>
          </button>
        </>
      );
      break;
    case 1: {
      const list = products
        .map((p, i) => ({ ...p, index: i }))
        .filter(
          (p) =>
            (state.category === "全部" || p.category === state.category) &&
            `${p.name}${p.material}`.includes(state.query),
        )
        .sort((a, b) =>
          state.sort === "价格从低到高"
            ? a.price - b.price
            : state.sort === "交期从短到长"
              ? a.lead - b.lead
              : a.index - b.index,
        );
      content = (
        <>
          {heading(
            "THE OBJECT LIBRARY",
            "为日常，挑选一件好物。",
            "按空间需要筛选，不按照片冲动下单。所有规格与价格均为演示。",
          )}
          <div className="fm-filters">
            <input
              aria-label="搜索家具"
              placeholder="搜索名称或材质"
              value={state.query}
              onChange={(e) => update({ query: e.target.value }, false)}
            />
            <select
              aria-label="家具排序"
              value={state.sort}
              onChange={(e) => update({ sort: e.target.value }, false)}
            >
              {["精选", "价格从低到高", "交期从短到长"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="fm-pills">
            {["全部", "座椅", "沙发", "桌几", "照明"].map((c) => (
              <button
                key={c}
                aria-pressed={c === state.category}
                onClick={() => update({ category: c }, false)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="fm-product-grid">
            {list.map((x) => card(x.index))}
          </div>
          {!list.length && (
            <div className="fm-empty">
              <h2>没有匹配的物件</h2>
              <button
                onClick={() => update({ query: "", category: "全部" }, false)}
              >
                重置筛选
              </button>
            </div>
          )}
        </>
      );
      break;
    }
    case 2:
      content = (
        <>
          <section className="fm-story-split">
            {img(images.room, "四件家具构成的客厅概念")}
            <div>
              {heading(
                "ROOM EDIT / 01",
                "留一半，给生活。",
                "客厅不必围绕屏幕。让沙发与单椅形成对话，让茶几留下经过的空间。",
              )}
              <dl>
                <dt>建议参考面积</dt>
                <dd>18–26 m²</dd>
                <dt>完整组合示例价</dt>
                <dd>{money(products.reduce((s, p) => s + p.price, 0))}</dd>
                <dt>包含物件</dt>
                <dd>休闲椅、沙发、茶几、落地灯各一件</dd>
              </dl>
              <button
                onClick={() => {
                  let cart = state.cart;
                  products.forEach((_, i) => {
                    cart = add(
                      { product: i, finish: "walnut", fabric: "linen", qty: 1 },
                      cart,
                    );
                  });
                  update({ cart, page: 10 });
                }}
              >
                将四件组合加入清单
              </button>
            </div>
          </section>
          <div className="fm-three">
            <article>
              <b>01 / 动线</b>
              <h3>留出行走距离</h3>
              <p>
                沙发与茶几之间可从约 40–50 cm 的间距开始尝试，再按家庭需求调整。
              </p>
            </article>
            <article>
              <b>02 / 光线</b>
              <h3>让光分层</h3>
              <p>
                灯具靠近阅读位，避免光源直接进入坐姿视线。真实照度需现场确认。
              </p>
            </article>
            <article>
              <b>03 / 克制</b>
              <h3>先留白，再添置</h3>
              <p>
                在地面贴出轮廓，试走路线。概念图好看，并不代表适合所有户型。
              </p>
            </article>
          </div>
        </>
      );
      break;
    case 3:
      content = (
        <>
          <section className="fm-detail">
            {img(p.image, p.name)}
            <div>
              <small>{p.en}</small>
              <h1>{p.name}</h1>
              <p>{p.description}</p>
              <strong className="fm-price">{money(price(selectedLine))}</strong>
              <span className="fm-muted">示例单价 · 配置变化不重绘参考图</span>
              {state.selected < 2 && (
                <>
                  <label className="fm-field">
                    木色
                    <select
                      aria-label="木色"
                      value={state.finish}
                      onChange={(e) =>
                        update({ finish: e.target.value as Line["finish"] })
                      }
                    >
                      <option value="walnut">胡桃木</option>
                      <option value="oak">浅橡木 − ¥200</option>
                    </select>
                  </label>
                  <label className="fm-field">
                    面料
                    <select
                      aria-label="面料"
                      value={state.fabric}
                      onChange={(e) =>
                        update({ fabric: e.target.value as Line["fabric"] })
                      }
                    >
                      <option value="linen">亚麻</option>
                      <option value="wool">羊毛混纺 + ¥300</option>
                    </select>
                  </label>
                </>
              )}
              <label className="fm-field">
                采购数量
                <input
                  aria-label="采购数量"
                  type="number"
                  min={1}
                  max={20}
                  value={state.quantity}
                  onChange={(e) =>
                    update({ quantity: clamp(+e.target.value, 1, 20) })
                  }
                />
              </label>
              <button onClick={addCurrent}>
                加入采购清单 · {money(price(selectedLine) * state.quantity)}
              </button>
              <button
                className="fm-text-button"
                onClick={() => toggleFavorite(state.selected)}
              >
                {state.favorites.includes(state.selected)
                  ? "取消收藏"
                  : "收藏这件物件"}
              </button>
            </div>
          </section>
          <div className="fm-spec-row">
            <span>宽 {p.w} cm</span>
            <span>深 {p.d} cm</span>
            <span>高 {p.h} cm</span>
            <span>示例备货 {p.lead} 天</span>
          </div>
          <h2>构造与日常</h2>
          <p>{p.detail}</p>
          <div className="fm-actions">
            <button onClick={() => go(5)}>查看尺寸与入户</button>
            <button onClick={() => go(4)}>了解材质</button>
            <button
              onClick={() => {
                update({
                  compare: [
                    ...new Set([...state.compare, state.selected]),
                  ].slice(-3),
                  page: 7,
                });
              }}
            >
              加入对比
            </button>
          </div>
        </>
      );
      break;
    case 4:
      content = (
        <>
          {heading(
            "THE MATERIAL LIBRARY",
            "看见纹理，也理解差异。",
            "选配会影响配置与价格；实物颜色、耐久性和触感需要线下样品验证。",
          )}
          <div className="fm-material-grid">
            {materialInfo.map((m, i) => (
              <article key={m.tag}>
                {img(m.image, m.name)}
                <small>{m.tag}</small>
                <h2>{m.name}</h2>
                <p>{m.text}</p>
                <button
                  onClick={() => {
                    setCare(i);
                    go(20);
                  }}
                >
                  阅读养护建议 ↗
                </button>
              </article>
            ))}
          </div>
          <div className="fm-swatches">
            <button
              aria-pressed={state.finish === "walnut"}
              onClick={() => update({ finish: "walnut" })}
            >
              <i className="walnut" />
              深胡桃木
            </button>
            <button
              aria-pressed={state.finish === "oak"}
              onClick={() => update({ finish: "oak" })}
            >
              <i className="oak" />
              浅橡木
            </button>
            <p>
              以上为数字材质示意，不是实物色卡。当前木色用于后续座椅、沙发选配。
            </p>
          </div>
        </>
      );
      break;
    case 5: {
      const entry =
        state.selected === 1
          ? Math.min(114, p.d, p.h)
          : Math.min(p.w, p.d, p.h);
      content = (
        <>
          {heading(
            "MEASURE BEFORE YOU ORDER",
            "确认尺度，比确认颜色更早。",
            "此工具只进行单方向净宽初筛，不计算转弯、包装或楼梯。不能作为实际可入户保证。",
          )}
          <div className="fm-two">
            <div className="fm-dimension">
              {img(p.image, p.name)}
              <div>← {p.w} cm →</div>
              <span>
                深 {p.d} / 高 {p.h} cm
              </span>
            </div>
            <div>
              <label className="fm-field">
                检查物件
                <select
                  aria-label="尺寸检查物件"
                  value={state.selected}
                  onChange={(e) => update({ selected: +e.target.value }, false)}
                >
                  {products.map((x, i) => (
                    <option value={i} key={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fm-field">
                入户净宽 / cm
                <input
                  aria-label="入户净宽"
                  type="number"
                  min={50}
                  max={200}
                  value={state.door}
                  onChange={(e) =>
                    update({ door: clamp(+e.target.value, 50, 200) })
                  }
                />
              </label>
              <div className="fm-callout">
                <h2>
                  {state.door >= entry + 5 ? "净宽初筛通过" : "需要进一步核查"}
                </h2>
                <p>
                  参考最小边 {entry} cm + 预留 5 cm = {entry + 5} cm；当前门洞{" "}
                  {state.door} cm。
                  {state.selected === 1 ? "沙发按可拆模块估算。" : ""}
                </p>
              </div>
              <ul>
                <li>测量门套内侧，不能只量门扇。</li>
                <li>记录电梯门、轿厢和楼道转角。</li>
                <li>真实包装尺寸、可拆部件须向供应商确认。</li>
              </ul>
              <button onClick={() => go(21)}>把尺寸问题写入咨询</button>
            </div>
          </div>
        </>
      );
      break;
    }
    case 6: {
      const setPosition = (x: number, y: number, record = true) =>
        update(
          {
            layout: state.layout.map((pos, i) =>
              i === layoutItem
                ? {
                    x: clamp(x, 0, state.roomWidth - products[i].w),
                    y: clamp(y, 0, state.roomDepth - products[i].d),
                  }
                : pos,
            ),
          },
          record,
        );
      content = (
        <>
          {heading(
            "SPACE PLANNER / 2D",
            "把物件放进你的尺度里。",
            "拖动轮廓，或使用坐标输入调整位置。二维占地示意不检测碰撞、不提供建筑施工结论。",
          )}
          <div className="fm-planner">
            <div className="fm-floor">
              <svg
                viewBox={`0 0 ${state.roomWidth} ${state.roomDepth}`}
                aria-label="可拖动家具平面图"
                role="img"
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  if (dragStart.current) {
                    undo.current = [...undo.current, dragStart.current].slice(
                      -40,
                    );
                    redo.current = [];
                    dragStart.current = null;
                  }
                  const b = e.currentTarget.getBoundingClientRect();
                  setPosition(
                    ((e.clientX - b.left) / b.width) * state.roomWidth -
                      products[layoutItem].w / 2,
                    ((e.clientY - b.top) / b.height) * state.roomDepth -
                      products[layoutItem].d / 2,
                    false,
                  );
                }}
                onPointerCancel={() => {
                  dragStart.current = null;
                }}
                onPointerUp={(e) => {
                  dragStart.current = null;
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }}
              >
                <rect
                  width={state.roomWidth}
                  height={state.roomDepth}
                  fill="#ebe5d9"
                />
                {products.map((x, i) => (
                  <g
                    key={x.id}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      dragStart.current = state;
                      setLayoutItem(i);
                      e.currentTarget.ownerSVGElement!.setPointerCapture(
                        e.pointerId,
                      );
                    }}
                    transform={`translate(${Math.min(state.layout[i].x, state.roomWidth - x.w)} ${Math.min(state.layout[i].y, state.roomDepth - x.d)})`}
                  >
                    <rect
                      width={x.w}
                      height={x.d}
                      rx={i === 2 ? 25 : 8}
                      fill={["#ae8d6c", "#d7c8b7", "#b5b09b", "#6f7661"][i]}
                      stroke={layoutItem === i ? "#352d25" : "#fff"}
                      strokeWidth={layoutItem === i ? 3 : 1}
                    />
                    <text
                      x={x.w / 2}
                      y={x.d / 2}
                      textAnchor="middle"
                      fontSize={i === 3 ? 7 : 11}
                      fill="#302d27"
                    >
                      {x.name}
                    </text>
                  </g>
                ))}
              </svg>
              <small>单位 cm · 显示四件标准配置 · 不等于已加入清单</small>
            </div>
            <aside>
              <div className="fm-two">
                {(["roomWidth", "roomDepth"] as const).map((k, i) => (
                  <label className="fm-field" key={k}>
                    {i ? "空间深度" : "空间宽度"}
                    <input
                      aria-label={i ? "空间深度" : "空间宽度"}
                      type="number"
                      min={250}
                      max={i ? 900 : 800}
                      value={state[k]}
                      onChange={(e) =>
                        update({
                          [k]: clamp(+e.target.value, 250, i ? 900 : 800),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="fm-field">
                定位物件
                <select
                  aria-label="定位物件"
                  value={layoutItem}
                  onChange={(e) => setLayoutItem(+e.target.value)}
                >
                  {products.map((x, i) => (
                    <option key={x.id} value={i}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fm-field">
                水平位置 / cm
                <input
                  aria-label="水平位置"
                  type="number"
                  value={Math.min(
                    state.layout[layoutItem].x,
                    state.roomWidth - products[layoutItem].w,
                  )}
                  onChange={(e) =>
                    setPosition(+e.target.value, state.layout[layoutItem].y)
                  }
                />
              </label>
              <label className="fm-field">
                垂直位置 / cm
                <input
                  aria-label="垂直位置"
                  type="number"
                  value={Math.min(
                    state.layout[layoutItem].y,
                    state.roomDepth - products[layoutItem].d,
                  )}
                  onChange={(e) =>
                    setPosition(state.layout[layoutItem].x, +e.target.value)
                  }
                />
              </label>
              <p>
                建议先预留门口通道，再安排停留区域。每次拖动都保存在当前项目中。
              </p>
              <button
                onClick={() => {
                  update({ layout: structuredClone(initial.layout) });
                }}
              >
                恢复默认摆放
              </button>
            </aside>
          </div>
        </>
      );
      break;
    }
    case 7:
      content = (
        <>
          {heading(
            "COMPARE WITH INTENTION",
            "不是更多，而是更适合。",
            "最多对比三件物件，先看尺度与用途，再看价格。",
          )}
          <div className="fm-pills">
            {products.map((x, i) => (
              <button
                key={x.id}
                aria-pressed={state.compare.includes(i)}
                onClick={() => {
                  if (!state.compare.includes(i) && state.compare.length >= 3) {
                    msg("最多同时对比三件，请先移除一件。");
                    return;
                  }
                  update({
                    compare: state.compare.includes(i)
                      ? state.compare.filter((n) => n !== i)
                      : [...state.compare, i],
                  });
                }}
              >
                {x.name}
                {state.compare.includes(i) ? " ✓" : " +"}
              </button>
            ))}
          </div>
          {state.compare.length ? (
            <div className="fm-table-wrap">
              <table className="fm-compare">
                <thead>
                  <tr>
                    <th>选配参考</th>
                    {state.compare.map((i) => (
                      <th key={i}>
                        {img(products[i].image, products[i].name)}
                        {products[i].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "标准价格",
                      ...state.compare.map((i) => money(products[i].price)),
                    ],
                    [
                      "宽 / 深 / 高",
                      ...state.compare.map(
                        (i) =>
                          `${products[i].w} / ${products[i].d} / ${products[i].h} cm`,
                      ),
                    ],
                    [
                      "主要材质",
                      ...state.compare.map((i) => products[i].material),
                    ],
                    [
                      "示例备货",
                      ...state.compare.map((i) => `${products[i].lead} 天`),
                    ],
                    [
                      "空间作用",
                      ...state.compare.map(
                        (i) =>
                          [
                            "单人阅读、独处",
                            "三人交谈、休息",
                            "低位置物、会客",
                            "局部照明、阅读",
                          ][i],
                      ),
                    ],
                  ].map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, i) => (
                        <td key={i}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            empty("先选择需要比较的物件")
          )}
        </>
      );
      break;
    case 8:
      content = (
        <>
          <section className="fm-editorial">
            {img(images.room, "暖色客厅灵感")}
            <div>
              <small>JOURNAL / A ROOM OF YOUR OWN</small>
              <h1>
                把喜欢的生活，
                <br />
                写成空间的线索。
              </h1>
            </div>
          </section>
          <div className="fm-two">
            <div>
              <h2>从一个习惯开始</h2>
              <p>
                周末的阅读、三两朋友的交谈、黄昏的一杯茶。记录真正发生的日常，再为它选择合适的坐姿、光线和触感。
              </p>
              <p>
                这里的空间是 AI
                概念图，不是客户实景。请把它当作讨论方向，而不是必须复刻的答案。
              </p>
            </div>
            <div>
              {field("项目名称", "project")}
              <label className="fm-field">
                空间方向
                <select
                  aria-label="空间方向"
                  value={state.style}
                  onChange={(e) => update({ style: e.target.value })}
                >
                  {["温暖自然", "克制留白", "阅读友好"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {field("我的空间笔记", "notes", true)}
              <button onClick={() => go(6)}>带着笔记调整布局 ↗</button>
            </div>
          </div>
        </>
      );
      break;
    case 9:
      content = (
        <>
          {heading(
            "YOUR SHORTLIST",
            "先留下喜欢的，再慢慢决定。",
            `${state.favorites.length} 件收藏 · 独立保存在当前浏览器的这个项目中`,
          )}
          {state.favorites.length ? (
            <div className="fm-product-grid">{state.favorites.map(card)}</div>
          ) : (
            empty("你的收藏清单还是空的。")
          )}
        </>
      );
      break;
    case 10:
      content = (
        <>
          {heading(
            "PROCUREMENT LIST",
            "一份有分寸的清单。",
            "数量修改会同步影响预算和报价；不同材质配置会分别计价。",
          )}
          {state.cart.length ? (
            <>
              {lineTable(state.cart, true)}
              <div className="fm-total">
                <span>产品小计</span>
                <strong>{money(subtotal)}</strong>
                <button onClick={() => go(11)}>继续核对预算 ↗</button>
              </div>
            </>
          ) : (
            empty("还没有加入采购物件。")
          )}
        </>
      );
      break;
    case 11:
      content = (
        <>
          {heading(
            "BUDGET, MADE VISIBLE",
            "把预算用在真正重要的地方。",
            "示例价格按含税零售价展示，不计算额外税费；所有金额仅用于本地方案评估。",
          )}
          <div className="fm-budget">
            <div>
              <label className="fm-field">
                项目预算 / 元
                <input
                  aria-label="项目预算"
                  type="number"
                  min={1000}
                  max={1000000}
                  value={state.budget}
                  onChange={(e) =>
                    update({ budget: clamp(+e.target.value, 1000, 1000000) })
                  }
                />
              </label>
              <div className="fm-budget-bar">
                <i
                  style={{
                    width: Math.min(100, (grand / state.budget) * 100) + "%",
                  }}
                />
              </div>
              <h2>
                {grand > state.budget
                  ? "超出预算 " + money(grand - state.budget)
                  : "预算余量 " + money(state.budget - grand)}
              </h2>
              {state.cart.map((l, i) => (
                <div className="fm-allocation" key={i}>
                  <span>{products[l.product].name}</span>
                  <b>{money(price(l) * l.qty)}</b>
                  <i
                    style={{
                      width:
                        (subtotal ? ((price(l) * l.qty) / subtotal) * 100 : 0) +
                        "%",
                    }}
                  />
                </div>
              ))}
            </div>
            <aside>
              <small>PROJECT ESTIMATE</small>
              <h2 aria-label="项目总价">{money(grand)}</h2>
              <dl>
                <dt>产品</dt>
                <dd>{money(subtotal)}</dd>
                <dt>配送</dt>
                <dd>
                  {money(state.cart.length ? shipping(state.delivery) : 0)}
                </dd>
                <dt>组装</dt>
                <dd>{money(state.cart.length && state.assembly ? 360 : 0)}</dd>
              </dl>
              <p>清单为空时不收取示例服务费。交付配置会实时更新这里的金额。</p>
              <button onClick={() => go(12)}>配置交付服务</button>
            </aside>
          </div>
        </>
      );
      break;
    case 12:
      content = (
        <>
          {heading(
            "DELIVERY OPTIONS",
            "从门口，到合适的位置。",
            "以下为演示配送政策，不查询真实地址、运力、库存或服务覆盖。",
          )}
          <div className="fm-three">
            {["自行提取", "基础配送", "入户搬运"].map((name, i) => (
              <button
                className="fm-delivery-card"
                key={name}
                aria-pressed={state.delivery === i}
                onClick={() => update({ delivery: i })}
              >
                <small>0{i + 1}</small>
                <h2>{name}</h2>
                <strong>{money(shipping(i))}</strong>
                <p>
                  {
                    [
                      "需自备适用车辆和固定保护措施。",
                      "送至约定的可卸货地点，不含楼层搬运。",
                      "示例包含可使用电梯的入户搬运，不承诺复杂吊装。",
                    ][i]
                  }
                </p>
                <span>{state.delivery === i ? "已选择 ✓" : "选择方案 +"}</span>
              </button>
            ))}
          </div>
          <label className="fm-check">
            <input
              type="checkbox"
              checked={state.assembly}
              onChange={(e) => update({ assembly: e.target.checked })}
            />
            添加组装示例服务 · ¥360 / 项目
          </label>
          <div className="fm-callout">
            <h3>下单前需要补充的资料</h3>
            <p>
              楼层、电梯尺寸、停车卸货条件，以及入户通道最窄处。真实项目应在供应商确认后才能确定最终服务费。
            </p>
            <button onClick={() => go(13)}>填写交付联系</button>
          </div>
        </>
      );
      break;
    case 13:
      content = (
        <>
          {heading(
            "PROJECT CONTACT",
            "让交付信息，清楚而完整。",
            "仅保存在本机。可使用虚构联系人试用；不要在公共设备保存真实个人信息。",
          )}
          <div className="fm-contact-layout">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customerValid) go(14);
                else
                  msg(
                    "请填写联系人、有效邮箱或电话，以及至少 5 字的地址说明。",
                  );
              }}
            >
              {field("联系人", "client")}
              {field("邮箱或电话", "contact")}
              {field("交付地址说明", "address")}
              <button type="submit">核对报价 ↗</button>
            </form>
            <aside>
              {img(images.lamp, "纸间落地灯")}
              <h3>我们没有发送任何信息。</h3>
              <p>
                这里不会向商家、物流或第三方传输资料。你可以在交付页下载方案，也可以清空联系信息。
              </p>
              <button
                onClick={() => update({ client: "", contact: "", address: "" })}
              >
                清空当前联系信息
              </button>
            </aside>
          </div>
        </>
      );
      break;
    case 14:
      content = (
        <>
          {heading(
            "REVIEW YOUR ESTIMATE",
            "在确认之前，再看一遍。",
            "修改产品、配置或交付选项后，当前报价会重新计算。已生成的回执不随清单变化。",
          )}
          {state.cart.length
            ? lineTable(state.cart)
            : empty("清单为空，暂时不能生成订单。")}
          <div className="fm-two">
            <article>
              <h2>交付给</h2>
              <p>
                {state.client || "尚未填写联系人"}
                <br />
                {state.contact || "尚未填写联系方式"}
                <br />
                {state.address || "尚未填写地址"}
              </p>
              <button onClick={() => go(13)}>修改联系人</button>
            </article>
            <article>
              <h2>{money(grand)}</h2>
              <p>
                产品 {money(subtotal)} + 配送{" "}
                {money(state.cart.length ? shipping(state.delivery) : 0)} + 组装{" "}
                {money(state.cart.length && state.assembly ? 360 : 0)}
              </p>
              <label className="fm-check">
                <input
                  aria-label="确认本地演示"
                  type="checkbox"
                  checked={state.agreed}
                  onChange={(e) => update({ agreed: e.target.checked })}
                />
                我理解这是本地演示，不会扣款、预订库存或配送。
              </label>
              <button disabled={!ready} onClick={() => go(15)}>
                进入模拟结算
              </button>
              {!ready && (
                <p className="fm-muted">
                  需要非空清单、有效联系人与地址，并勾选演示说明。
                </p>
              )}
            </article>
          </div>
        </>
      );
      break;
    case 15:
      content = (
        <div className="fm-checkout">
          {heading(
            "LOCAL DEMONSTRATION ONLY",
            "保存一份决定，\n不是支付一笔款项。",
            "无需银行卡、支付密码或付款授权。这里仅生成不可随清单变化的本地演示回执。",
          )}
          <strong>{money(grand)}</strong>
          <p>
            {state.client || "联系人待补充"} ·{" "}
            {state.cart.reduce((a, l) => a + l.qty, 0)} 件物件
          </p>
          <button
            disabled={!ready}
            onClick={() => {
              if (!ready) return;
              if (
                state.receipt &&
                !confirm(
                  "当前只保留最近一份演示订单，是否替换？请先导出旧回执。",
                )
              )
                return;
              update(
                {
                  receipt: {
                    id: "FM-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
                    createdAt: new Date().toISOString(),
                    client: state.client,
                    contact: state.contact,
                    address: state.address,
                    lines: structuredClone(state.cart),
                    delivery: state.delivery,
                    assembly: state.assembly,
                    total: grand,
                    status: "draft",
                  },
                  page: 16,
                },
                false,
              );
            }}
          >
            生成本地演示订单
          </button>
          <button className="fm-text-button" onClick={() => go(14)}>
            返回报价审核
          </button>
        </div>
      );
      break;
    case 16:
      content = state.receipt ? (
        <section className="fm-receipt">
          <small>FORME / LOCAL RECEIPT</small>
          <h1>
            方案已记录。
            <br />
            留给生活，慢慢发生。
          </h1>
          <p>
            未付款 · 未发送 ·{" "}
            {state.receipt.status === "cancelled"
              ? "已在本地取消"
              : "本地演示订单"}
          </p>
          <div className="fm-spec-row">
            <span>{state.receipt.id}</span>
            <span>
              {new Date(state.receipt.createdAt).toLocaleDateString("zh-CN")}
            </span>
          </div>
          {lineTable(state.receipt.lines)}
          <div className="fm-total">
            <span>回执金额（含所选服务）</span>
            <strong>{money(state.receipt.total)}</strong>
          </div>
          <p>
            {state.receipt.client} · {state.receipt.contact}
            <br />
            {state.receipt.address}
          </p>
          <div className="fm-actions">
            <button
              onClick={() => saveJson("forme-receipt.json", state.receipt)}
            >
              下载回执 JSON
            </button>
            <button onClick={() => go(17)}>管理演示订单</button>
          </div>
        </section>
      ) : (
        empty("还没有生成演示回执。", "检查报价", 14)
      );
      break;
    case 17:
      content = (
        <>
          {heading(
            "ORDER DESK",
            "你的决定，有迹可循。",
            "只保存最近一份演示订单。取消不会联系商家，也不存在退款。",
          )}
          {state.receipt ? (
            <div className="fm-order-card">
              <div>
                <small>{state.receipt.id}</small>
                <h2>{state.receipt.client} 的空间方案</h2>
                <p>
                  {state.receipt.lines.length} 个配置 ·{" "}
                  {money(state.receipt.total)}
                </p>
                <strong>
                  {state.receipt.status === "cancelled"
                    ? "已取消（本地）"
                    : "待人工确认（演示）"}
                </strong>
              </div>
              <div className="fm-actions">
                <button onClick={() => go(16)}>查看回执</button>
                <button
                  disabled={state.receipt.status === "cancelled"}
                  onClick={() => {
                    if (
                      confirm("仅取消本地演示订单，不涉及付款或退款。确定吗？")
                    )
                      update(
                        { receipt: { ...state.receipt!, status: "cancelled" } },
                        false,
                      );
                  }}
                >
                  取消演示订单
                </button>
              </div>
            </div>
          ) : (
            empty("暂时没有本地演示订单。", "检查报价", 14)
          )}
        </>
      );
      break;
    case 18:
      content = (
        <>
          {heading(
            "ARRIVAL CHECKLIST",
            "抵达之后，不急着拆完。",
            "这是一张独立的现场检查表，不是物流轨迹，也不表示商品已经发货。",
          )}
          <div className="fm-two">
            <div className="fm-inspection">
              {checkLabels.map((label, i) => (
                <label key={label}>
                  <span>0{i + 1}</span>
                  <input
                    aria-label={label}
                    type="checkbox"
                    checked={state.checked.includes(i)}
                    onChange={() =>
                      update({
                        checked: state.checked.includes(i)
                          ? state.checked.filter((n) => n !== i)
                          : [...state.checked, i],
                      })
                    }
                  />
                  {label}
                </label>
              ))}
              <p>{state.checked.length} / 6 项已记录</p>
            </div>
            <aside>
              {img(images.chair, "弧线休闲椅参考")}
              <h2>留下证据，再讨论处理。</h2>
              <p>
                若发现外观问题，先记录包装、标签和整体照片，并联系实际商家确认处理规则。此原型不上传照片、不代替签收记录。
              </p>
              <button onClick={() => go(19)}>记录售后问题</button>
            </aside>
          </div>
        </>
      );
      break;
    case 19:
      content = (
        <>
          {heading(
            "AFTERCARE NOTE",
            "把问题描述清楚。",
            "生成本地售后草稿，不会创建商家工单或承诺处理时效。",
          )}
          <div className="fm-two">
            <div>
              <label className="fm-field">
                问题类型
                <select
                  aria-label="问题类型"
                  value={state.serviceType}
                  onChange={(e) => update({ serviceType: e.target.value })}
                >
                  {["尺寸咨询", "材质养护", "缺件记录", "外观问题"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {field("问题描述", "serviceNote", true)}
              <p>
                建议包含物件名称、发现时间、问题部位和希望得到的帮助，不填写支付信息。
              </p>
              <button
                onClick={() => {
                  if (state.serviceNote.trim().length < 10) {
                    msg("请至少填写 10 字的问题描述。");
                    return;
                  }
                  update({
                    ticket: `本地售后草稿 / ${state.serviceType}\n${new Date().toLocaleString("zh-CN")}\n${state.serviceNote}`,
                  });
                  msg("售后草稿已在本地记录，尚未发送。");
                }}
              >
                记录售后草稿
              </button>
            </div>
            <aside className="fm-paper">
              <small>YOUR AFTERCARE DRAFT</small>
              <pre>{state.ticket || "尚未记录售后草稿。"}</pre>
              <button
                disabled={!state.ticket}
                onClick={() =>
                  download(
                    new Blob([state.ticket], {
                      type: "text/plain;charset=utf-8",
                    }),
                    "forme-aftercare.txt",
                  )
                }
              >
                下载售后草稿
              </button>
            </aside>
          </div>
        </>
      );
      break;
    case 20:
      content = (
        <>
          {heading(
            "CARE FOR WHAT YOU KEEP",
            "让喜欢的物件，多陪伴一些时间。",
            "以下是通用养护提示，不代替真实产品标签与制造商说明。",
          )}
          <div className="fm-pills">
            {materialInfo.map((m, i) => (
              <button
                key={m.tag}
                aria-pressed={care === i}
                onClick={() => setCare(i)}
              >
                {m.name}
              </button>
            ))}
          </div>
          <div className="fm-care">
            {img(materialInfo[care].image, materialInfo[care].name)}
            <div>
              <small>{materialInfo[care].tag}</small>
              <h2>{materialInfo[care].name}</h2>
              <p>{materialInfo[care].care}</p>
              <ol>
                <li>先识别表面处理和洗护标签。</li>
                <li>先在隐蔽处小范围尝试，避免一次大面积处理。</li>
                <li>出现开裂、松动或电气异常时停止使用，并咨询实际制造商。</li>
              </ol>
              <button onClick={() => go(19)}>还有问题？记录咨询</button>
            </div>
          </div>
        </>
      );
      break;
    case 21:
      content = (
        <>
          {heading(
            "DESIGN CONSULTATION",
            "从你的日常，开始讨论空间。",
            "可填写理想沟通时段并生成咨询简报；不会预订设计师日历或发送邮件。",
          )}
          <div className="fm-two">
            <div>
              {field("项目名称", "project")}
              <label className="fm-field">
                意向日期
                <input
                  aria-label="咨询意向日期"
                  type="date"
                  value={state.consultDate}
                  onChange={(e) => update({ consultDate: e.target.value })}
                />
              </label>
              <label className="fm-field">
                意向时段
                <select
                  aria-label="咨询意向时段"
                  value={state.consultTime}
                  onChange={(e) => update({ consultTime: e.target.value })}
                >
                  {["上午", "下午", "傍晚"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {field("咨询重点", "consultBrief", true)}
              <button
                onClick={() => {
                  if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(state.consultDate) ||
                    state.consultBrief.trim().length < 10
                  ) {
                    msg("请选择日期，并填写至少 10 字的咨询重点。");
                    return;
                  }
                  update({
                    consultRecord: `${state.project}\n意向：${state.consultDate} ${state.consultTime}\n空间：${state.roomWidth} × ${state.roomDepth} cm\n预算：${money(state.budget)}\n${state.consultBrief}\n仅为本地意向简报，尚未发送或预约。`,
                  });
                  msg("咨询简报已记录。");
                }}
              >
                生成本地咨询简报
              </button>
            </div>
            <aside className="fm-paper">
              <small>DESIGN BRIEF</small>
              <pre>
                {state.consultRecord ||
                  "记录生活习惯、空间限制与最需要解决的问题。"}
              </pre>
              <button
                disabled={!state.consultRecord}
                onClick={() =>
                  download(
                    new Blob([state.consultRecord], {
                      type: "text/plain;charset=utf-8",
                    }),
                    "forme-consultation.txt",
                  )
                }
              >
                下载咨询简报
              </button>
            </aside>
          </div>
        </>
      );
      break;
    case 22:
      content = (
        <>
          {heading(
            "READY TO TAKE WITH YOU",
            "把想法，带到下一次讨论。",
            "交付的是你的当前方案与本地记录，不代表可购买商品、合同、支付成功或完整网站源码。",
          )}
          <div className="fm-export-grid">
            {[
              {
                n: "01",
                title: "采购报价",
                type: "CSV / 表格",
                body: "当前配置、数量、单价和服务费。文本字段有电子表格公式防护。",
                run: saveCSV,
              },
              {
                n: "02",
                title: "空间方案",
                type: "HTML / 内嵌图片",
                body: "包含当前项目笔记、产品图片、清单和预算的离线方案。可用浏览器打印为 PDF。",
                run: exportHTML,
              },
              {
                n: "03",
                title: "项目备份",
                type: "JSON / 结构数据",
                body: "包含当前参数与回执的本地备份记录。不开放未经验证的任意 JSON 导入。",
                run: () =>
                  saveJson("forme-project.json", {
                    schema: "forme.v1",
                    state,
                    provenance:
                      "AI概念图、虚构品牌与示例产品；未付款、未发送。",
                  }),
              },
            ].map((x) => (
              <article key={x.n}>
                <small>
                  {x.n} / {x.type}
                </small>
                <h2>{x.title}</h2>
                <p>{x.body}</p>
                <button disabled={exporting && x.n === "02"} onClick={x.run}>
                  {exporting && x.n === "02"
                    ? "正在嵌入图片…"
                    : `下载${x.title}`}
                </button>
              </article>
            ))}
          </div>
          <div className="fm-callout">
            <h3>分享前检查隐私</h3>
            <p>
              HTML 与项目 JSON
              可能包含你填写的联系信息。清空当前联系人不会修改已经生成的订单回执；请检查导出文件后再自行分享。
            </p>
          </div>
        </>
      );
      break;
    default:
      content = (
        <>
          <section className="fm-story-split">
            {img(images.room, "为 FORME 生成的概念空间")}
            <div>
              {heading(
                "ABOUT THIS CONCEPT",
                "FORME，不止一个好看的封面。",
                "一套从选品、配置到本地交付的 24 页家具采购原型。",
              )}
              <p>
                品牌、物件名称、价格和规格均为设计演示。五张图片专门为本套项目生成，不是实拍产品、真实客户家或商业品牌授权案例。
              </p>
              <p>
                不会扣款、发送邮件、预订库存或查询物流。参数与副本默认保存在当前浏览器，也可通过顶部按钮手动备份到服务器；请在清理网站数据前保留备份。
              </p>
              <p>
                配置选项改变的是结构数据和示例价格，不会把照片实时渲染成所选材质。平面布局也不是三维建模或施工工具。
              </p>
              <button onClick={() => go(22)}>查看真实交付格式 ↗</button>
            </div>
          </section>
          <div className="fm-source-strip">
            {products.map((x) => (
              <figure key={x.id}>
                {img(x.image, x.name)}
                <figcaption>{x.name} / AI 概念图</figcaption>
              </figure>
            ))}
          </div>
        </>
      );
  }
  return (
    <main className="fm-work">
      <SampleTop
        type="原型 / 24 个业务页面"
        title="FORME · 家具选配与空间采购"
        draftId={draftId}
        onCopy={() => {
          try {
            copySample("forme", state);
          } catch {
            msg("副本保存失败，请先导出项目。");
          }
        }}
      >
        <button onClick={() => go(22)}>项目交付</button>
      </SampleTop>
      <Notice text={error || notice} />
      <div className="fm-worktools">
        <span>本地自动保存 · 未连接商家服务</span>
        <button
          disabled={!undo.current.length}
          onClick={() => {
            const previous = undo.current.pop();
            if (previous) {
              redo.current.push(state);
              set(previous);
            }
          }}
        >
          撤销
        </button>
        <button
          disabled={!redo.current.length}
          onClick={() => {
            const next = redo.current.pop();
            if (next) {
              undo.current.push(state);
              set(next);
            }
          }}
        >
          重做
        </button>
        <input
          aria-label="版本名称"
          placeholder="为版本命名"
          maxLength={40}
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
        />
        <button onClick={saveVersion}>保存版本</button>
        <select
          aria-label="恢复命名版本"
          value=""
          onChange={(e) => {
            const v = versions[+e.target.value];
            if (v && confirm(`恢复版本「${v.name}」？当前内容可用撤销找回。`))
              update(v.state);
          }}
        >
          <option value="">恢复版本（{versions.length}/6）</option>
          {versions.map((v, i) => (
            <option key={v.at + i} value={i}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="fm-shell">
        <nav className="fm-page-nav" aria-label="FORME 页面目录">
          <header>
            <b>FORME</b>
            <small>OBJECTS FOR LIVING</small>
          </header>
          {pages.map((name, i) => (
            <button
              key={name}
              aria-current={state.page === i ? "page" : undefined}
              onClick={() => go(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {name}
            </button>
          ))}
        </nav>
        <div className="fm-main">
          <div className="fm-brandbar">
            <span>FORME / {pages[state.page]}</span>
            <button onClick={() => go(10)}>
              采购清单 <b>{state.cart.reduce((a, l) => a + l.qty, 0)}</b>
            </button>
          </div>
          <section
            className={`fm-page fm-page-${state.page}`}
            aria-label={pages[state.page]}
          >
            {content}
          </section>
          <footer className="fm-page-footer">
            <span>
              {String(state.page + 1).padStart(2, "0")} / 24 · 本地交互原型
            </span>
            <div>
              <button
                disabled={state.page === 0}
                onClick={() => go(state.page - 1)}
              >
                ← 上一页
              </button>
              <button
                disabled={state.page === 23}
                onClick={() => go(state.page + 1)}
              >
                下一页 →
              </button>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
