import room from "../../../assets/forme/room.webp";
import chair from "../../../assets/forme/chair.webp";
import sofa from "../../../assets/forme/sofa.webp";
import table from "../../../assets/forme/table.webp";
import lamp from "../../../assets/forme/lamp.webp";
export const images = { room, chair, sofa, table, lamp };
export const pages = [
  "品牌首页",
  "家具目录",
  "客厅搭配",
  "单品详情",
  "材质图书馆",
  "尺寸与入户",
  "空间布局",
  "单品对比",
  "场景灵感",
  "收藏清单",
  "采购清单",
  "项目预算",
  "交付配置",
  "客户信息",
  "报价审核",
  "模拟结算",
  "订单回执",
  "订单管理",
  "交付检查",
  "售后申请",
  "养护指南",
  "设计咨询",
  "项目交付",
  "品牌与来源",
];
export const products = [
  {
    id: "chair",
    name: "弧线休闲椅",
    en: "ARC / LOUNGE CHAIR",
    category: "座椅",
    image: chair,
    price: 3280,
    w: 76,
    d: 82,
    h: 74,
    lead: 14,
    material: "胡桃木 / 亚麻",
    description:
      "弧形扶手接住手臂，也让视线缓缓流动。适合阅读角和客厅的第二个停留点。",
    detail:
      "座高 41 cm，扶手高 58 cm。坐垫为可拆式设计，底部采用软质脚垫；具体承重与防火等级不作实际产品承诺。",
  },
  {
    id: "sofa",
    name: "云屿三人沙发",
    en: "ISLE / MODULAR SOFA",
    category: "沙发",
    image: sofa,
    price: 12800,
    w: 228,
    d: 96,
    h: 72,
    lead: 28,
    material: "圈绒 / 木质底座",
    description: "低重心，宽坐面。让交谈、阅读与午后小憩，拥有同样从容的尺度。",
    detail:
      "座高 39 cm，座深 62 cm。示例由两个模块组成；入户估算按单模块宽 114 cm 计算，不能替代现场勘验。",
  },
  {
    id: "table",
    name: "原石椭圆茶几",
    en: "MONO / COFFEE TABLE",
    category: "桌几",
    image: table,
    price: 4680,
    w: 120,
    d: 64,
    h: 32,
    lead: 21,
    material: "洞石 / 填孔表面",
    description:
      "看见石材的纹理，也保留房间里的留白。圆润的边缘让行走路径更柔和。",
    detail:
      "台面厚 6 cm；采用示例填孔、封护工艺。石材纹理天然不均，概念图不能作为实物选板依据。",
  },
  {
    id: "lamp",
    name: "纸间落地灯",
    en: "PAPER / FLOOR LIGHT",
    category: "照明",
    image: lamp,
    price: 1680,
    w: 42,
    d: 42,
    h: 148,
    lead: 7,
    material: "纸质灯罩 / 木脚",
    description: "将光变得柔软。在墙边、沙发旁，留下一小片安静的暖意。",
    detail:
      "示例光源参数为 2700K、8W LED；真实电气认证、插头制式与能效需由实际供应商确认。",
  },
];
export const money = (n: number) =>
  "¥" +
  n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export type Line = {
  product: number;
  finish: "walnut" | "oak";
  fabric: "linen" | "wool";
  qty: number;
};
export type Receipt = {
  id: string;
  createdAt: string;
  client: string;
  contact: string;
  address: string;
  lines: Line[];
  delivery: number;
  assembly: boolean;
  total: number;
  status: "draft" | "cancelled";
};
export type FormeState = {
  page: number;
  selected: number;
  query: string;
  category: string;
  sort: string;
  finish: "walnut" | "oak";
  fabric: "linen" | "wool";
  quantity: number;
  favorites: number[];
  compare: number[];
  cart: Line[];
  project: string;
  client: string;
  contact: string;
  address: string;
  roomWidth: number;
  roomDepth: number;
  door: number;
  budget: number;
  layout: { x: number; y: number }[];
  delivery: number;
  assembly: boolean;
  agreed: boolean;
  notes: string;
  checked: number[];
  receipt: Receipt | null;
  serviceType: string;
  serviceNote: string;
  ticket: string;
  consultDate: string;
  consultTime: string;
  consultBrief: string;
  consultRecord: string;
  style: string;
};
export const initial: FormeState = {
  page: 0,
  selected: 0,
  query: "",
  category: "全部",
  sort: "精选",
  finish: "walnut",
  fabric: "linen",
  quantity: 1,
  favorites: [],
  compare: [0, 1],
  cart: [],
  project: "我的安静客厅",
  client: "",
  contact: "",
  address: "",
  roomWidth: 420,
  roomDepth: 500,
  door: 90,
  budget: 26000,
  layout: [
    { x: 250, y: 180 },
    { x: 18, y: 25 },
    { x: 80, y: 200 },
    { x: 320, y: 40 },
  ],
  delivery: 0,
  assembly: false,
  agreed: false,
  notes: "保留自然光，选择经得起日常使用的材质。",
  checked: [],
  receipt: null,
  serviceType: "尺寸咨询",
  serviceNote: "",
  ticket: "",
  consultDate: "",
  consultTime: "上午",
  consultBrief: "",
  consultRecord: "",
  style: "温暖自然",
};
export const price = (l: Line) =>
  products[l.product].price +
  (l.product < 2
    ? (l.finish === "oak" ? -200 : 0) + (l.fabric === "wool" ? 300 : 0)
    : 0);
export const variant = (l: Line) =>
  l.product < 2
    ? `${l.finish === "walnut" ? "胡桃木" : "浅橡木"} / ${l.fabric === "linen" ? "亚麻" : "羊毛混纺"}`
    : "标准款";
export const shipping = (delivery: number) => [0, 280, 680][delivery] || 0;
export const total = (s: Pick<FormeState, "cart" | "delivery" | "assembly">) =>
  s.cart.reduce((sum, l) => sum + price(l) * l.qty, 0) +
  (s.cart.length ? shipping(s.delivery) + (s.assembly ? 360 : 0) : 0);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const int = (v: unknown, a: number, b: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= a && v <= b;
const validLine = (l: unknown): l is Line =>
  record(l) &&
  int(l.product, 0, 3) &&
  int(l.qty, 1, 20) &&
  ["walnut", "oak"].includes(String(l.finish)) &&
  ["linen", "wool"].includes(String(l.fabric));
export function restoreForme(raw: unknown): FormeState {
  const s: FormeState = structuredClone(initial);
  if (!record(raw)) return s;
  const nums: Record<string, [number, number]> = {
    page: [0, 23],
    selected: [0, 3],
    quantity: [1, 20],
    roomWidth: [250, 800],
    roomDepth: [250, 900],
    door: [50, 200],
    budget: [1000, 1000000],
    delivery: [0, 2],
  };
  for (const [k, [a, b]] of Object.entries(nums))
    if (int(raw[k], a, b))
      (s as unknown as Record<string, unknown>)[k] = raw[k];
  for (const k of [
    "project",
    "client",
    "contact",
    "address",
    "query",
    "notes",
    "serviceNote",
    "ticket",
    "consultDate",
    "consultBrief",
    "consultRecord",
  ] as const)
    if (typeof raw[k] === "string")
      s[k] = (raw[k] as string).slice(
        0,
        k === "notes" ||
          k === "serviceNote" ||
          k === "consultBrief" ||
          k === "consultRecord"
          ? 1200
          : 200,
      );
  const choices = {
    category: ["全部", "座椅", "沙发", "桌几", "照明"],
    sort: ["精选", "价格从低到高", "交期从短到长"],
    finish: ["walnut", "oak"],
    fabric: ["linen", "wool"],
    style: ["温暖自然", "克制留白", "阅读友好"],
    serviceType: ["尺寸咨询", "材质养护", "缺件记录", "外观问题"],
    consultTime: ["上午", "下午", "傍晚"],
  };
  for (const [k, options] of Object.entries(choices))
    if (typeof raw[k] === "string" && options.includes(raw[k] as string))
      (s as unknown as Record<string, unknown>)[k] = raw[k];
  for (const k of ["assembly", "agreed"] as const)
    if (typeof raw[k] === "boolean") s[k] = raw[k] as boolean;
  for (const k of ["favorites", "compare", "checked"] as const)
    if (Array.isArray(raw[k]))
      s[k] = [
        ...new Set(
          (raw[k] as unknown[]).filter((n): n is number =>
            int(n, 0, k === "checked" ? 5 : 3),
          ),
        ),
      ].slice(0, k === "compare" ? 3 : 6);
  if (
    Array.isArray(raw.cart) &&
    raw.cart.length <= 12 &&
    raw.cart.every(validLine)
  )
    s.cart = raw.cart.map((l) => ({ ...l }));
  if (
    Array.isArray(raw.layout) &&
    raw.layout.length === 4 &&
    raw.layout.every((p) => record(p) && int(p.x, 0, 800) && int(p.y, 0, 900))
  )
    s.layout = raw.layout.map((p) => ({
      x: Math.min(p.x, s.roomWidth),
      y: Math.min(p.y, s.roomDepth),
    }));
  if (record(raw.receipt)) {
    const r = raw.receipt;
    if (
      typeof r.id === "string" &&
      /^FM-[A-Z0-9-]{4,50}$/.test(r.id) &&
      typeof r.createdAt === "string" &&
      Number.isFinite(Date.parse(r.createdAt)) &&
      ["client", "contact", "address"].every((k) => typeof r[k] === "string") &&
      Array.isArray(r.lines) &&
      r.lines.length > 0 &&
      r.lines.length <= 12 &&
      r.lines.every(validLine) &&
      int(r.delivery, 0, 2) &&
      typeof r.assembly === "boolean" &&
      ["draft", "cancelled"].includes(String(r.status))
    ) {
      const lines = r.lines.map((l) => ({ ...l }));
      s.receipt = {
        id: r.id,
        createdAt: r.createdAt,
        client: String(r.client).slice(0, 200),
        contact: String(r.contact).slice(0, 200),
        address: String(r.address).slice(0, 200),
        lines,
        delivery: r.delivery,
        assembly: r.assembly,
        total: total({
          cart: lines,
          delivery: r.delivery,
          assembly: r.assembly,
        }),
        status: r.status as Receipt["status"],
      };
    }
  }
  return s;
}
