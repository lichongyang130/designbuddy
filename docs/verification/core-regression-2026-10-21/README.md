# 全量回归验证证据（2026-10-21）

本目录保存 2026-10-21 这一轮回归运行产生的**全部原始产物**（93 个文件，约 14 MB）。
代码在提交 `41e55c3`，产物在此一并入库，便于离线复核与 PR 讨论。

## 运行环境

- 应用：`node scripts/dev-full.mjs`，Web `:5273` / API `:8787`
- 浏览器：`@sparticuz/chromium` 解压到 `/tmp/chromium`（沙箱无法访问浏览器 CDN）
- 命令：`node node_modules/@playwright/test/cli.js test <spec> --reporter=line`
- 提交：`41e55c3 fix(home): 自动匹配改显式同意，弹窗不再遮输入框，结构化确认 fail closed`

## 结果

| 范围 | 结果 |
|---|---|
| 非 inspiration（57 个 spec） | **418 passed, 3 skipped, 0 failed** |
| inspiration（11 个 spec） | **143 passed, 19 failed** |
| `tsc --noEmit` | 通过 |
| `i18n-catalog.test.mjs` | 4/4 |
| home / home-reference / model-menu / model-registry / attach-menu | 43 passed |
| settings | 9/9 |
| notifications | 10/10 |
| task-skills | 8/8 |
| workflows | 5/5 |
| clarification + conversation | 27 passed |
| expert-match | 18/18 |
| account + account-reference + settings-models | 20 passed |
| expert-trigger-layout + attach-menu | 17 passed |

**19 条 inspiration 失败与本分支无关**：另开 `21f6dc4` 的 worktree、独立端口（web `:5281` / api `:8791`）复跑同一批用例，结果一致。成因是模板套件 `studio-nine` / `wellspring` / `circuit` 未挂到 `/inspiration/:id` 路由（`.kit-root` 不存在）、分类用例仍按 5 张卡而目录已扩到 10 张、ATELIER 的「生成本地演示单」按钮已改名。

## 产物说明

`artifacts/` 是 `.cache/` 的原样拷贝（该目录被 `.gitignore` 忽略，属于本地运行产物）：

- 根目录的 `*.png` 多为各 spec 的桌面 / 手机双视口截图，文件名即对应用例主题；
- `atelier/`、`daylight/`、`morrow/`、`roots/`、`tide/` 是 inspiration 样例的逐页导出与走查截图（其中也包含上述既有失败的现场）；
- `brand-system-evidence/`、`layout-browser-artifacts/` 是技能执行台真实导出的 HTML / SVG / JSON / 字体许可文本，可直接打开复核「导出的确是真实文件」。

这些文件全部可再生：`node scripts/run-playwright.mjs test tests/<spec>` 会重新写回 `.cache/`。

## 文件清单（93）

| 文件 | 大小 |
|---|---|
| `account-reference-desktop.png` | 93 KB |
| `advanced-join-mobile.png` | 99 KB |
| `advanced-pdf-ocr.png` | 80 KB |
| `asr-audio-preview.png` | 27 KB |
| `asr-mobile-390.png` | 23 KB |
| `asr-word-timing-preview.png` | 48 KB |
| `atelier/offline.png` | 58 KB |
| `atelier/technical-1440.png` | 180 KB |
| `atelier/technical-320.png` | 129 KB |
| `atelier/technical-375.png` | 131 KB |
| `atelier/technical-768.png` | 143 KB |
| `brand-system-evidence/brand-avatar-512.png` | 16 KB |
| `brand-system-evidence/brand-guidelines-desktop.png` | 185 KB |
| `brand-system-evidence/brand-guidelines-mobile.png` | 179 KB |
| `brand-system-evidence/brand-guidelines.html` | 652 KB |
| `brand-system-evidence/brand-icon-64.png` | 2 KB |
| `brand-system-evidence/brand-system.css` | 0 KB |
| `brand-system-evidence/brand-system.json` | 2 KB |
| `brand-system-evidence/font-license.txt` | 4 KB |
| `brand-system-evidence/logo-lockup.svg` | 8 KB |
| `brand-system-evidence/logo-symbol.svg` | 0 KB |
| `clarification-desktop.png` | 84 KB |
| `clarification-mobile.png` | 49 KB |
| `daylight/home-1440.png` | 323 KB |
| `daylight/home-320.png` | 151 KB |
| `daylight/home-375.png` | 186 KB |
| `daylight/home-768.png` | 152 KB |
| `daylight/layout-1440.png` | 139 KB |
| `daylight/layout-320.png` | 124 KB |
| `daylight/layout-375.png` | 124 KB |
| `daylight/layout-768.png` | 131 KB |
| `daylight/offline.png` | 62 KB |
| `docx-structure-mobile.png` | 6 KB |
| `docx-structure-preview.png` | 12 KB |
| `expert-avatars-directory.png` | 465 KB |
| `expert-detail-mobile.png` | 455 KB |
| `expert-match-desktop.png` | 84 KB |
| `experts-redesign-desktop.png` | 464 KB |
| `formula-batch-results.png` | 47 KB |
| `home-expert-trigger.png` | 70 KB |
| `home-launcher-1440.png` | 63 KB |
| `home-text-shortcuts.png` | 63 KB |
| `infographic-comparison-preview.png` | 49 KB |
| `infographic-composition-preview.png` | 48 KB |
| `infographic-mobile-390.png` | 48 KB |
| `infographic-trend-preview.png` | 52 KB |
| `layout-browser-artifacts/execution-receipt.json` | 2 KB |
| `layout-browser-artifacts/font-license.txt` | 4 KB |
| `layout-browser-artifacts/poster-project.json` | 3 KB |
| `layout-browser-artifacts/poster-report.json` | 6 KB |
| `layout-browser-artifacts/poster.png` | 65 KB |
| `layout-browser-artifacts/poster.svg` | 55 KB |
| `layout-canvas-320.png` | 12 KB |
| `layout-canvas-390.png` | 17 KB |
| `layout-canvas-desktop.png` | 38 KB |
| `layout-controls-390.png` | 40 KB |
| `layout-output-320.png` | 16 KB |
| `layout-output-390.png` | 20 KB |
| `layout-preview.png` | 31 KB |
| `morrow/home-1440.png` | 493 KB |
| `morrow/home-320.png` | 248 KB |
| `morrow/home-375.png` | 272 KB |
| `morrow/home-768.png` | 266 KB |
| `morrow/layout-1440.png` | 142 KB |
| `morrow/layout-320.png` | 113 KB |
| `morrow/layout-375.png` | 113 KB |
| `morrow/layout-768.png` | 131 KB |
| `morrow/offline.png` | 57 KB |
| `pdf-batch-mobile.png` | 108 KB |
| `phase-three-mobile-review.png` | 84 KB |
| `phase-two-mobile.png` | 79 KB |
| `phase-two-poster-desktop.png` | 543 KB |
| `roots/home-1440.png` | 850 KB |
| `roots/home-320.png` | 269 KB |
| `roots/home-375.png` | 303 KB |
| `roots/home-768.png` | 436 KB |
| `roots/layout-1440.png` | 173 KB |
| `roots/layout-320.png` | 120 KB |
| `roots/layout-375.png` | 124 KB |
| `roots/layout-768.png` | 157 KB |
| `roots/offline.png` | 71 KB |
| `skill-runtime-desktop.png` | 151 KB |
| `skill-runtime-mobile.png` | 86 KB |
| `task-skills-mobile.png` | 102 KB |
| `tide/home-1440.png` | 770 KB |
| `tide/home-320.png` | 246 KB |
| `tide/home-375.png` | 269 KB |
| `tide/home-768.png` | 420 KB |
| `tide/layout-1440.png` | 173 KB |
| `tide/layout-320.png` | 129 KB |
| `tide/layout-375.png` | 133 KB |
| `tide/layout-768.png` | 153 KB |
| `tide/offline.png` | 88 KB |
