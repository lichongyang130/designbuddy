#!/usr/bin/env node
// Inventory is NOT browser/visual acceptance. All legacy claims stay explicitly unverified here.
const fs = require("node:fs"),
  path = require("node:path");
const {
  benchmarkTemplates,
  benchmarkVersion,
} = require("../dist/local/shared/commercialTemplates.js");
const source = fs.readFileSync(
  path.resolve(__dirname, "../apps/web/src/inspiration/samples/shared.tsx"),
  "utf8",
);
const welcome = fs.readFileSync(
  path.resolve(__dirname, "../apps/web/src/inspiration/welcomeTemplates.ts"),
  "utf8",
);
const legacy = [];
for (const m of welcome.matchAll(
  /id:\s*"(welcome-\d+)"[\s\S]*?name:\s*"([^"]+)"/g,
))
  legacy.push({
    id: m[1],
    name: m[2],
    category: "图片",
    exports: "PNG / 设计参考",
  });
const body = source.slice(
  source.indexOf("export const samples:"),
  source.indexOf("export type DraftRecord"),
);
for (const m of body.matchAll(
  /\{\s*id:\s*"([^"]+)"(?:\s+as const)?\s*,\s*category:\s*"([^"]+)"\s*,\s*title:\s*"([^"]+)"[\s\S]*?format:\s*"([^"]+)"/g,
))
  legacy.push({ id: m[1], category: m[2], name: m[3], exports: m[4] });
if (legacy.length !== 46 || new Set(legacy.map((t) => t.id)).size !== 46)
  throw Error(
    "Legacy inventory mismatch; review source parser before regenerating.",
  );
const newItems = benchmarkTemplates
  .filter((t) => t.id !== "forme")
  .map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    exports: t.format,
  }));
const catalog = require("../design-templates/catalog.json");
const audit = {
  schemaVersion: 1,
  version: benchmarkVersion,
  method:
    "Static source inventory. Capability claims do not constitute complete commercial acceptance.",
  summary: {
    registered: legacy.length + newItems.length,
    legacy: legacy.length,
    newBenchmarks: newItems.length,
    catalog: catalog.length,
    industryCategories: new Set(catalog.map((t) => t.category)).size,
    descriptorCount: catalog.reduce((n, t) => n + t.screens.length, 0),
    uniquePageNameSequences: new Set(
      catalog.map((t) => JSON.stringify(t.screens.map((s) => s.name))),
    ).size,
  },
  registered: [...newItems, ...legacy].map((t) => ({
    ...t,
    source: newItems.some((n) => n.id === t.id)
      ? "shared/commercialTemplates.ts:benchmarkTemplates"
      : t.id.startsWith("welcome-")
        ? "apps/web/src/inspiration/welcomeTemplates.ts"
        : "apps/web/src/inspiration/samples/shared.tsx:samples",
    duplicateReview:
      "ID 唯一已检查；不把源码登记或页面数量当作视觉/业务独立性认证",
    capabilities: {
      preview: newItems.some((n) => n.id === t.id)
        ? "可运行工作区，证据见验证记录"
        : "现有入口；本轮逐套动态复核待办",
      editing: newItems.some((n) => n.id === t.id)
        ? "本地编辑/恢复/副本及授权云快照"
        : "现有能力待逐套复核",
      exports: t.exports,
    },
    license: newItems.some((n) => n.id === t.id)
      ? {
          status: "declared-original-with-exceptions",
          content: "CC0-1.0",
          font: "Noto Sans SC / SIL OFL",
          code: "原代码和依赖许可不变",
          source: "apps/web/public/template-benchmarks/README.md",
        }
      : {
          status: "pending-per-asset-review",
          source: "既有素材声明需逐套复核，不推定全目录同一许可",
        },
    openReviewItems: newItems.some((n) => n.id === t.id)
      ? [
          "用户业务与视觉验收",
          "目标软件/设备编辑复核",
          "实际品牌与数据替换后的权利复核",
        ]
      : ["逐套内容和视觉缺陷核查", "逐套编辑与导出实测", "素材来源和许可核对"],
    commercialApproval: false,
    stage: newItems.some((n) => n.id === t.id) ? "本批实现" : "既有模板",
    dataMode:
      t.id === "pro-cost" || t.id === "live"
        ? "本地计算"
        : t.category === "实时产物"
          ? "本地/模拟数据"
          : "原创/示例内容",
    review: newItems.some((n) => n.id === t.id)
      ? "实现与导出证据见验证记录；业务验收待审"
      : "已有能力声明；待本轮逐套复核",
  })),
  catalog: catalog.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    source: "design-templates/catalog.json",
    duplicateReview:
      "与全部130系列具有相同页面名称序列；这是描述层去重信号，非独立页面已实现的证据",
    capabilities: {
      preview: "目录详情",
      editing: "待独立业务实现与验证",
      exports: "待逐套实现与验证",
    },
    license: {
      status: "pending-per-asset-review",
      source: "此处只有描述登记，不替未提供的行业素材授权",
    },
    commercialApproval: false,
    stage: "目录描述，不计为独立已验收成品",
    missing: [
      "独立业务页面图",
      "实际交互与异常状态证据",
      "逐套导出/授权/验收记录",
    ],
  })),
};
fs.mkdirSync(
  path.resolve(__dirname, "../apps/web/public/template-benchmarks"),
  { recursive: true },
);
fs.writeFileSync(
  path.resolve(
    __dirname,
    "../apps/web/public/template-benchmarks/readiness.json",
  ),
  JSON.stringify(audit, null, 2) + "\n",
);
console.log(JSON.stringify(audit.summary));
