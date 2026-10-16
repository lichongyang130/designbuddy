import { useState } from "react";
import { useSceneState } from "./workspace";
import { csvCell, downloadText, money, Toolbar } from "./shared";
import { readTable } from "./tabular";
export type Order = {
  id: string;
  customer: string;
  product: string;
  qty: number;
  price: number;
  status: string;
  date: string;
  owner: string;
};
export function OrderEditor({
  orders,
  onChange,
  readOnly,
}: {
  orders: Order[];
  onChange: (v: Order[]) => void;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false),
    [customer, setCustomer] = useState(""),
    [product, setProduct] = useState("AURA ONE 标准版"),
    [qty, setQty] = useState("1"),
    [price, setPrice] = useState("1299"),
    [error, setError] = useState("");
  return (
    <div className="ws-order-create">
      <div className="ws-actions">
        <button disabled={readOnly} onClick={() => setOpen(!open)}>
          {open ? "取消新增" : "＋ 新建订单"}
        </button>
        <label className={`ws-upload ${readOnly ? "disabled" : ""}`}>
          导入订单 CSV / XLSX
          <input
            disabled={readOnly}
            type="file"
            accept=".csv,.xlsx"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const rows = await readTable(file);
                if (rows[0]?.join(",") !== "订单号,客户,商品,数量,单价,状态")
                  throw new Error(
                    "列顺序必须为：订单号、客户、商品、数量、单价、状态。可在交付中心下载模板。",
                  );
                const seen = new Set<string>();
                const parsed = rows.slice(1).map((r, i) => {
                  if (
                    r.length !== 6 ||
                    !r[0] ||
                    seen.has(r[0]) ||
                    !r[1]?.trim() ||
                    !r[2]?.trim() ||
                    !/^\d+$/.test(r[3]) ||
                    +r[3] < 1 ||
                    +r[3] > 999 ||
                    !r[4].trim() ||
                    !Number.isFinite(+r[4]) ||
                    +r[4] < 0 ||
                    +r[4] > 1e7 ||
                    !["待处理", "已发货", "已完成", "已取消"].includes(r[5])
                  )
                    throw new Error(`第 ${i + 2} 行字段不合法或编号重复。`);
                  seen.add(r[0]);
                  return {
                    id: r[0],
                    customer: r[1],
                    product: r[2],
                    qty: +r[3],
                    price: +r[4],
                    status: r[5],
                    date: new Date().toISOString().slice(0, 10),
                    owner: "待分配",
                  };
                });
                if (!parsed.length) throw new Error("没有订单数据。");
                if (
                  confirm(
                    `用 ${parsed.length} 条导入记录替换全部订单？可撤销。`,
                  )
                ) {
                  onChange(parsed);
                  setError(`已导入 ${parsed.length} 条订单。`);
                }
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
        </label>
        <small>仅本地业务账本，不触发库存扣减或物流。</small>
      </div>
      {open && (
        <form
          className="ws-record-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !customer.trim() ||
              !product.trim() ||
              !Number.isInteger(+qty) ||
              +qty < 1 ||
              +qty > 999 ||
              !Number.isFinite(+price) ||
              +price < 0
            ) {
              setError("请填写有效的客户、商品、数量和价格。");
              return;
            }
            onChange([
              {
                id: `AU-${Date.now()}`,
                customer: customer.trim(),
                product,
                qty: +qty,
                price: +price,
                status: "待处理",
                date: new Date().toISOString().slice(0, 10),
                owner: "林晓",
              },
              ...orders,
            ]);
            setOpen(false);
            setCustomer("");
            setError("订单已创建为本地待处理记录。");
          }}
        >
          <label>
            客户
            <input
              aria-label="新订单客户"
              required
              maxLength={80}
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
          </label>
          <label>
            商品
            <input
              aria-label="新订单商品"
              required
              maxLength={80}
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            />
          </label>
          <label>
            数量
            <input
              aria-label="新订单数量"
              type="number"
              min="1"
              max="999"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label>
            单价
            <input
              aria-label="新订单单价"
              type="number"
              min="0"
              max="10000000"
              step=".01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <button disabled={readOnly}>创建订单</button>
        </form>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}
const seedProducts = [
  { id: "P-001", name: "AURA ONE 标准版", price: 1299, stock: 128, min: 20 },
  { id: "P-002", name: "AURA ONE 商务套装", price: 1299, stock: 16, min: 20 },
  { id: "P-003", name: "AURA ONE 体验租赁", price: 199, stock: 35, min: 10 },
];
const seedCustomers = [
  {
    id: "C-001",
    name: "杭州星野设计",
    email: "studio@example.com",
    owner: "林晓",
  },
  {
    id: "C-002",
    name: "上海禾木工作室",
    email: "hello@example.com",
    owner: "陈宁",
  },
];
export function Operations({
  module,
  orders,
  readOnly,
}: {
  module: string;
  orders: Order[];
  readOnly: boolean;
}) {
  const [products, setProducts] = useSceneState("products", seedProducts),
    [customers, setCustomers] = useSceneState("customers", seedCustomers);
  const [editing, setEditing] = useState(""),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState("");
  const productMode = module === "产品目录" || module === "库存管理";
  const [form, setForm] = useState({
    name: "",
    price: "1299",
    stock: "0",
    min: "20",
    email: "",
    owner: "林晓",
  });
  const start = (id = "") => {
    setEditing(id || "new");
    const found = productMode
      ? products.find((p) => p.id === id)
      : customers.find((c) => c.id === id);
    setForm({
      name: "",
      price: "1299",
      stock: "0",
      min: "20",
      email: "",
      owner: "林晓",
      ...Object.fromEntries(
        Object.entries(found || {}).map(([k, v]) => [k, String(v)]),
      ),
    });
  };
  const submit = () => {
    if (readOnly) return;
    if (!form.name.trim()) {
      setMessage("名称不能为空。");
      return;
    }
    if (productMode) {
      const nums = [form.price, form.stock, form.min].map(Number);
      if (
        nums.some((n) => !Number.isFinite(n) || n < 0) ||
        !Number.isInteger(nums[1]) ||
        !Number.isInteger(nums[2])
      ) {
        setMessage("价格非负，库存与预警值须为非负整数。");
        return;
      }
      const item = {
        id: editing === "new" ? `P-${Date.now()}` : editing,
        name: form.name.trim(),
        price: nums[0],
        stock: nums[1],
        min: nums[2],
      };
      setProducts((v) =>
        editing === "new"
          ? [...v, item]
          : v.map((p) => (p.id === editing ? item : p)),
      );
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        setMessage("邮箱格式不正确。");
        return;
      }
      const item = {
        id: editing === "new" ? `C-${Date.now()}` : editing,
        name: form.name.trim(),
        email: form.email,
        owner: form.owner,
      };
      setCustomers((v) =>
        editing === "new"
          ? [...v, item]
          : v.map((c) => (c.id === editing ? item : c)),
      );
    }
    setEditing("");
    setMessage("已保存本地记录。");
  };
  const report = module === "经营概览";
  const exportData = () => {
    const rows = report
      ? [
          ["日期", "订单数", "金额"],
          ...[...new Set(orders.map((o) => o.date))]
            .sort()
            .map((date) => [
              date,
              orders.filter((o) => o.date === date).length,
              orders
                .filter((o) => o.date === date && o.status !== "已取消")
                .reduce((s, o) => s + o.qty * o.price, 0),
            ]),
        ]
      : productMode
        ? [
            ["编号", "商品", "单价", "库存", "预警值"],
            ...products.map((p) => [p.id, p.name, p.price, p.stock, p.min]),
          ]
        : [
            ["编号", "客户", "邮箱", "负责人"],
            ...customers.map((c) => [c.id, c.name, c.email, c.owner]),
          ];
    downloadText(
      "operations-export.csv",
      "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  };
  return (
    <div className="ws-operations">
      <Toolbar brand="OPERATIONS /" title={module}>
        <button onClick={exportData}>导出 CSV</button>
      </Toolbar>
      <div className="ws-operations-content">
        <small>BUSINESS WORKSPACE / 本地业务资料</small>
        <h1>{module}</h1>
        {report ? (
          <>
            <div className="pd-order-metrics">
              <article>
                <small>有效订单金额</small>
                <strong>
                  {money(
                    orders
                      .filter((o) => o.status !== "已取消")
                      .reduce((s, o) => s + o.qty * o.price, 0),
                  )}
                </strong>
              </article>
              <article>
                <small>客户档案</small>
                <strong>{customers.length}</strong>
              </article>
              <article>
                <small>库存预警</small>
                <strong>
                  {products.filter((p) => p.stock < p.min).length}
                </strong>
              </article>
            </div>
            <h2>商品库存与补货</h2>
            <p>订单与库存为独立本地账本，不自动扣减；请在库存页核对记录。</p>
            <div className="ws-stock-chart">
              {products.map((p) => (
                <article key={p.id}>
                  <span>{p.name}</span>
                  <meter
                    value={p.stock}
                    min={0}
                    max={Math.max(...products.map((x) => x.stock), 1)}
                  />
                  <b>{p.stock} 件</b>
                </article>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="ws-actions">
              <input
                aria-label="搜索业务记录"
                placeholder="按名称搜索"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button disabled={readOnly} onClick={() => start()}>
                ＋ {productMode ? "新增商品" : "新增客户"}
              </button>
            </div>
            {editing && (
              <form
                className="ws-record-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label>
                  名称
                  <input
                    aria-label="业务记录名称"
                    required
                    maxLength={80}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                {(productMode
                  ? ["price", "stock", "min"]
                  : ["email", "owner"]
                ).map((key) => (
                  <label key={key}>
                    {
                      {
                        price: "价格",
                        stock: "库存",
                        min: "预警值",
                        email: "邮箱",
                        owner: "负责人",
                      }[key]
                    }
                    <input
                      aria-label={`业务记录${key}`}
                      type={
                        productMode
                          ? "number"
                          : key === "email"
                            ? "email"
                            : "text"
                      }
                      min="0"
                      max="10000000"
                      step={key === "price" ? ".01" : "1"}
                      required
                      value={form[key as keyof typeof form]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <button disabled={readOnly}>保存记录</button>
                <button type="button" onClick={() => setEditing("")}>
                  取消
                </button>
              </form>
            )}
            <div className="pd-table-scroll">
              <table aria-label={module}>
                <thead>
                  <tr>
                    <th>编号</th>
                    <th>名称</th>
                    {productMode ? (
                      <>
                        <th>单价</th>
                        <th>库存 / 预警</th>
                      </>
                    ) : (
                      <>
                        <th>联系邮箱</th>
                        <th>负责人</th>
                      </>
                    )}
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {productMode
                    ? products
                        .filter((p) => p.name.includes(query))
                        .map((p) => (
                          <tr key={p.id}>
                            <td>{p.id}</td>
                            <td>{p.name}</td>
                            <td>{money(p.price)}</td>
                            <td>
                              <span
                                className={
                                  p.stock < p.min ? "ws-stock-warning" : ""
                                }
                              >
                                {p.stock} / {p.min}
                                {p.stock < p.min ? " · 需补货" : ""}
                              </span>
                            </td>
                            <td>
                              <button
                                disabled={readOnly}
                                onClick={() => start(p.id)}
                              >
                                {module === "库存管理" ? "调整库存" : "编辑"}
                              </button>
                              <button
                                disabled={readOnly}
                                onClick={() => {
                                  if (
                                    confirm(
                                      `删除商品“${p.name}”？历史订单不变。`,
                                    )
                                  )
                                    setProducts((v) =>
                                      v.filter((x) => x.id !== p.id),
                                    );
                                }}
                              >
                                删除
                              </button>
                            </td>
                          </tr>
                        ))
                    : customers
                        .filter((c) => c.name.includes(query))
                        .map((c) => (
                          <tr key={c.id}>
                            <td>{c.id}</td>
                            <td>{c.name}</td>
                            <td>{c.email}</td>
                            <td>{c.owner}</td>
                            <td>
                              <button
                                disabled={readOnly}
                                onClick={() => start(c.id)}
                              >
                                编辑
                              </button>
                              <button
                                disabled={readOnly}
                                onClick={() => {
                                  if (
                                    confirm(
                                      `删除客户“${c.name}”？历史订单不变。`,
                                    )
                                  )
                                    setCustomers((v) =>
                                      v.filter((x) => x.id !== c.id),
                                    );
                                }}
                              >
                                删除
                              </button>
                            </td>
                          </tr>
                        ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p role="status">{message}</p>
        <small>权限仅为本地只读/编辑交互，不是服务端访问控制。</small>
      </div>
    </div>
  );
}
