# 演示主题库

`catalog.json` 是**演示稿主题**（DeckTheme），与 `design-systems/catalog.json`（代码项目的设计系统）是两回事：

| | 用途 | 数量 | 消费者 |
|---|---|---|---|
| `design-systems/catalog.json` | 设计系统 token，服务 `/library` 与代码项目 | 180 | `applyDesignSystemTokens`、Studio 的 design contract |
| `themes/catalog.json`（本目录） | 演示稿的外观（配色/字体/图形/版式/图片风格/图表） | 12 | `/themes` 画廊、`/ppt` 编辑器、PPTX 导出 |

## 约束（由 `shared/deckTheme.ts` 校验，测试在 `apps/web/tests/deck-theme.test.mjs`）

- 颜色必须是 6 位 hex；字体必须在 `THEME_FONTS` 白名单内
- 正文/背景对比度 < 4.5:1、强调色 < 3:1 时给出 warning（不阻断，界面明确显示真实比值）
- 图表配色至少 3 色
- `customCss` 只用于 HTML/PDF 导出，禁止 `@import` / `url(`，上限 4 KB

## 不允许做的事

- 主题里不放可执行内容、不放外链
- 不嵌入字体文件：只写字体名，导出时提示"对方机器缺字体会回退"
- 换主题不修改 `slides[]`，一个字都不动
