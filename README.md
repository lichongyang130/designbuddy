# DesignBuddy AI

Open-source AI design workspace and agent tooling. This repository contains a web application, an Electron desktop shell, API domain modules, generation utilities, retrieval components, and a preview runtime.


## Connected web + API preview

Use Node **22.13+** and `pnpm install --frozen-lockfile`, then **`pnpm dev:full`**.
This compiles the API and starts Web on `0.0.0.0:5173` and the SQLite-backed API
on `0.0.0.0:8787`. The browser uses same-origin `/api` through Vite. Root `.env`
and `.env.local` are loaded by this launcher; never commit credentials.

- The sidebar's **工作区状态** opens server health and real account registration,
  login and logout. On mobile, use **设置 → 个人主页 → 后台连接与账号**.
- Project sync and the **15 community templates' explicit server snapshots**
  persist in `data/designbuddy.sqlite`, with owner isolation and template revision
  conflict checks. **服务器作品** restores snapshots on another browser after login.
- Anonymous cookie loss cannot recover guest data: register first. Logout does
  **not** clear browser-local drafts. Back up the database before replacing the workspace.
- Optional **`pnpm setup:ffmpeg`** installs an ignored local FFmpeg runtime via
  Python/pip; restart `dev:full` to enable real Studio H.264 MP4 export.
- These are basic preview accounts, not a production identity platform. AI needs
  actual provider configuration; connectors, payments, inventory, merchant orders,
  and scheduling are **not** activated by storing a template snapshot.

See [后台接入说明与验收](docs/plans/backend-connection-report.md) and
[remaining functional gaps](docs/plans/functional-gap-audit.md).
Run `pnpm test:backend` and `pnpm --filter designbuddy-web test:backend` for
HTTP/server and browser integration checks. Browser tests start the full stack
when no existing dev server is running.

## Main areas

- `apps/web` — React + Vite application shell, shared API transport, and Web renderer; it is also the renderer loaded by Electron.
- `frontend/workspace` — workspace pages and components, workspace API adapters, routes, Zustand stores, project utilities, and workspace models used by the Web and desktop renderer.
- `apps/desktop` — Electron desktop entry point.
- `apps/api` — authentication, user, OAuth, and collaboration modules.
- `server/generator` — prompt analysis, project scaffolding, source validation, and preview adapters.
- `server/rag` — embeddings and vector retrieval.
- `server/preview-api`, `server/preview-engine`, `server/preview-worker` — preview-session API and runtime components.

## Current user workflows

- Homepage requests create a local project immediately and then start an AI first pass. If the API is unavailable, the local starter project remains editable and the editor reports the generation error.
- The editor can apply the full `design-systems/catalog.json` token set, export HTML/PDF/ZIP, and create a read-only share link that can be imported as a separate local copy.
- A **right-hand live preview** is available in two places, and both now start **open by default**: the task conversation shows it as soon as the task opens (and still opens by itself after the assistant generates or updates a web page), and the project editor opens on its **右侧预览** split — source on the left, running page on the right — instead of the single “设计预览” canvas. On phone-width viewports (≤680 px) the task panel would cover the conversation, so it starts closed there and is still one tap away in the title bar. Both render the current project files in a sandboxed iframe, so they need no build step, no preview worker and no network.
- **工作流**（`/workflows`）：固定配方的三步向导——填 1–3 个必填项 → 确认要跑什么 → 拿产物。配方由服务端注册表定义，每一步都调用**已登记的真实技能**（`infographic.compose`、`faq.page`、`table.analyze`、`document.format`/`document.summarize`、`document.structure`、`web.scaffold`、`social.card`），所以权限、单次授权、上限和产物都沿用既有规则。缺凭据或没授权的步骤会显式标成“不可用/已跳过”并写明缺什么，不会伪造结果；产物可下载、可“继续编辑”进编辑器、可“存为素材”进素材库。配方详情见 `docs/plans/workflow-plan.md`。
- **管理后台 / 运营控制台**（`/admin`）：面向这台服务器运维者的真实后台。**管理员名单只由服务端环境变量 `DESIGNBUDDY_ADMIN_ACCOUNTS` 决定**（逗号分隔的用户名；未配置时任何账号一律 403，不设假管理员；本机 trusted token `local-user` 视为管理员）。页面一次读出跨账号账号清单（可**停用/恢复**：停用立即删除该账号的全部会话并拒绝它再次登录）、AI 用量汇总（调用/输入/输出/失败/平均延迟 + 按模型）、任务与最近失败（带真实失败原因）、定时任务清单与上次运行结果、技能 ready/unavailable 的真实原因、最近审计；三个写动作（停用/恢复账号、重试失败任务、启停定时任务）都走任务与定时后端自己的逻辑并写审计，不是页面上改状态。证据与边界见 `docs/verification/admin-2026-10-17/`。
- Studio sends web, slide, vector-poster, and video-storyboard briefs through the configured AI provider; generated artifacts remain editable and can be exported to HTML/PPTX/PDF/Markdown, SVG/PNG, or WebM/MP4.
- Text attachments (`txt`, `md`, `json`, `html`, `css`, `js`, `csv`, `xml`, `yaml`) are read in the browser and included in the generation prompt, with per-file size limits. Other formats are not parsed yet.
- Experts and skills selected from the workspace are carried into the next generation request. Custom experts, skills, connectors, and saved catalog assets persist in browser storage.
- The “仅本地” task policy skips hosted AI generation; browser-cookie access to local coding CLIs is disabled; explicitly configured authenticated local tools may use the CLI endpoint. Browser-only review notes and share-by-copy work without a server. The local daemon adds SQLite-backed member roles, live comments/presence, and shared project sync; hosted multi-user use requires a real identity provider and shared database/broker.

## Important integration requirements

- The preview daemon provides salted-scrypt accounts and hashed opaque sessions. Production authentication needs further verification, recovery, auditing and abuse protection; do not use plaintext passwords.
- GitHub OAuth requires `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- High-quality semantic search requires a real embedding provider. The deterministic local embedding fallback is for development and lexical retrieval, not a replacement for a trained semantic model.
- Preview building and deployment require configured runtime/deployer adapters. The app must not report a deployment as ready unless a real runtime has returned a valid URL.
- The operator console is a real backend now: `GET /api/admin/overview` and the three admin write routes are served by the local daemon and gated by `DESIGNBUDDY_ADMIN_ACCOUNTS` (no list configured means every account is refused). It is still a single-server tool: no cost billing, no quota/limiting, no read-only roles, no cross-instance control, and no audit export or retention policy. The Agent Builder still only exposes callback interfaces.
- The desktop app loads a development URL only when `DESIGNBUDDY_DEV_SERVER_URL` is configured for an unpackaged build; packaged builds load the bundled web renderer.

## Project generation and cloud sync API

The editor calls same-origin `POST /api/generation` for AI-assisted HTML/CSS/JavaScript generation and `POST /api/projects` to save a project. `createProjectRepository()` selects SQLite by default (`DESIGNBUDDY_STORAGE=sqlite`, path `DESIGNBUDDY_SQLITE_PATH`) or the JSON file repository (`DESIGNBUDDY_STORAGE=file`, path `DESIGNBUDDY_PROJECT_STORE_PATH`). The current runtime requires Node 22.13 or newer. The handler and repositories live in `server/api/http-handler.ts` and `server/api/`.

The preview daemon now mounts these modules with SQLite sessions; production deployments must still provide hardened identity and durable storage. Configure `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` on the server, or choose a supported provider in the editor and enter a BYOK key. BYOK credentials stay in the current browser session and are sent only with generation requests; the server maps provider IDs to fixed OpenAI-compatible endpoints and does not save keys. `POST /api/proxy/:provider/stream` also exposes an authenticated SSE relay for those providers. Never put provider secrets in frontend/Vite build variables. The homepage model selector can override the model identifier, but the selected model must be served by the configured provider or compatible gateway. The web client defaults to same-origin `/api`; set `VITE_API_BASE_URL` at web build time to use a separately hosted backend (the client appends `/api`). For a cross-origin backend, configure exact credentialed CORS and secure session cookies. GitHub Pages serves static files only, so its preview deployment alone does not activate AI generation or cloud sync.

## MCP and collaboration endpoints

- `POST /api/mcp` implements MCP `2026-07-28` stateless discovery/tool calls plus `2025-03-26` initialize compatibility for owner-scoped project list/read/create/delete. `pnpm mcp:stdio` bridges local stdio clients; `pnpm mcp:install claude|cursor|gemini|claude-desktop|opencode|vscode` installs the bridge in supported agent configs (`--print` previews, `--uninstall` removes). Set `DESIGNBUDDY_LOCAL_TOKEN` before installing so the bridge can authenticate to the local daemon. Restart the agent after installation.
- `GET /api/projects/:id/collaboration/events` streams presence, cursor, comment, and document events over SSE; `POST /api/projects/:id/collaboration` publishes an event. `createLocalPersistence()` supplies SQLite project storage, member roles (`viewer`/`editor`), and event history. Project owners manage access with `GET/POST/DELETE /api/projects/:id/members`; add an authenticated account's user ID. Viewers can read, comment, and publish presence/cursor events; editors can also save project source. SSE clients poll the shared SQLite event table, so API processes using the same database file can share events. For multiple hosts, use a shared broker/database deployment.
- `POST /api/video/transcode` accepts WebM up to 100 MB and returns H.264 MP4 through FFmpeg. Set `FFMPEG_PATH` if the binary is not on `PATH`; isolate this endpoint in a worker/container for production workloads.

Run the local SQLite-backed daemon with `pnpm --filter designbuddy-web build` followed by `pnpm local:daemon`; it serves the built renderer and API on `0.0.0.0:8787`. Configure `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, and `FFMPEG_PATH` in the daemon environment as needed. Set `DESIGNBUDDY_ADMIN_ACCOUNTS` to a comma-separated list of account names to enable the operator console (`/admin`); with no list configured every account is refused with 403 and no fake administrator exists. The local agent runner supports installed Codex CLI, Claude Code, OpenCode, Gemini CLI, or Cursor Agent; browser-cookie requests are now refused. Tool access needs explicit Bearer credentials plus `DESIGNBUDDY_ENABLE_LOCAL_AGENT=true`; managed working copies use `data/agent-projects`. For stdio MCP clients, set `DESIGNBUDDY_LOCAL_TOKEN` to a secret you control and set `DESIGNBUDDY_MCP_TOKEN` to the same value when launching `pnpm mcp:stdio`.

The project editor also supports client-side ZIP export without a third-party ZIP dependency.

## Development

Use the package manager and scripts defined in the workspace manifests. Install with `pnpm install --frozen-lockfile`; start the connected web/API preview with `pnpm dev:full` (`pnpm --filter designbuddy-web dev` alone starts only Vite). Configure credentials through environment variables and local environment files; never commit secrets or production tokens.

Before deployment, install dependencies, run each workspace's build and tests, configure external providers, and review authorization, persistence, and runtime isolation.

## Homepage reference and regression checks

The homepage follows the supplied `1.png` reference (1024 × 797): a 239 px
sidebar, office mode selected by default, scene carousel, and 725 px composer.
The decorative buddy and top rewards promotion were removed on request. Task counts reflect local projects rather than the sample count
in the screenshot. Cropped decorative assets are documented in
`apps/web/src/assets/README.md`; no screenshot is used as the page background.

Run the browser regression checks after installing dependencies:

```sh
pnpm --filter designbuddy-web exec playwright install chromium
pnpm --filter designbuddy-web test:home
```

The suite starts Vite and the API automatically and covers desktop geometry, keyboard mode
switching, scene scrolling, model selection/dismissal, text attachments, Chinese
IME handling, local-only project creation, and overflow at 320–1440 px. The host
needs Chromium system libraries and a Chinese font for visual review. In managed
environments, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can point to an existing
Chromium installation. Hosted AI generation is not exercised by these UI checks.

## Expert marketplace reference

`/experts` follows `2.png`: the WorkBuddy sidebar, compact top navigation and
search, horizontally scrollable themed collections, category and sort controls,
and a three-column expert directory. At smaller widths the directory collapses
to two or one columns without horizontal page overflow. The homepage and expert
page share `WorkBuddySidebar`; the skill and connector markets also share this
navigation, with their reference layouts described below.

- Search matches expert names, descriptions, categories and tags.
- “我的专家” shows only locally created experts, with creation, persistence and
  detail screens. Selecting an expert or team carries its role into a new task.
- The reference avatars, names and popularity values are demonstration catalog
  content, not official integrations, endorsements or live usage analytics.
  “最热” sorts those static values; “最新” sorts custom experts by creation time
  and leaves built-ins in their catalog order.
- Run `pnpm --filter designbuddy-web test:experts` for expert-page checks, or
  `pnpm --filter designbuddy-web test:ui` for the full homepage + expert + skill + connector suite.

## Skill marketplace reference

`/skills` follows the supplied `7.png` cards and adds the shared left navigation
on request. The main area has a compact navigation/search/install toolbar, three featured cards, recommendation/suite
tabs, category filters, and a three-column directory. Layout responds to the remaining content width beside the sidebar: featured
cards scroll horizontally on narrow screens and the directory becomes two or
one columns. On phones the shared navigation moves above the content.

- “换一批” cycles featured presets. Search and category filters match the local
  catalog and custom skills.
- Card “＋” buttons save skill definitions into the persisted workspace store.
  `/skills/installed` shows the real locally saved count (not the screenshot's
  sample count of 10); repeated and overlapping suite installations are
  deduplicated by ID. Skill details allow removal and task handoff.
- `/skills/create` creates custom skill definitions with a category and task
  instructions. Custom deletion requires confirmation.
- “Install” only saves local task presets: it does not download executables,
  run plugins, provision third-party APIs, or implement document conversion.
  External-service requirements are explained on each applicable detail page.
  The two zero counters reproduce reference placeholders, not live analytics.
- Run `pnpm --filter designbuddy-web test:skills` for skill layout, search,
  categories, refresh, persistence, suite deduplication, custom creation/deletion,
  task handoff, integration disclosures and responsive-layout checks.

## Connector marketplace reference

`/connectors` follows the supplied `8.png`: the shared left navigation, compact
market navigation/search/custom-connector toolbar, and three columns of 92 px
connector cards. Cards collapse to two or one columns according to the remaining
content width. The original GitHub, Notion, Figma, database and cloud entries
remain available alongside the reference catalog.

- Search filters names and descriptions; card/add controls open the matching
  configuration and integration-requirements screen. Catalog descriptions and
  branding are reference examples, not assertions of working integrations.
- GitHub and Notion retain the existing backend OAuth-start contract. Redirects
  accept only their expected HTTPS authorization endpoints. Authorization failure
  never creates a connected state; an OAuth callback triggers server verification
  rather than trusting URL query parameters.
- Connection status is verified through `GET /api/connectors`; disconnect uses
  the existing server endpoint. The response is validated and only public metadata
  is persisted, excluding arbitrary response fields such as tokens. These APIs
  still require a deployed/authenticated implementation. OAuth tests mock both
  the backend and provider; they do not establish real external authorizations.
- `/connectors/create` saves local custom MCP endpoint metadata (name, description,
  HTTPS URL and transport). It does not contact the service or install an MCP
  runtime. URLs containing credentials, query parameters or fragments are rejected;
  secrets are not collected. Saved custom configurations support confirmed deletion.
- Run `pnpm --filter designbuddy-web test:connectors` for connector-specific
  layout, search, custom-config persistence, OAuth/error/status verification and
  responsive regression checks.

## Task conversation reference

Submitting a homepage task now opens `/tasks/:id`, following `4.png`: shared left
navigation, a compact title bar, right-aligned question bubbles, WorkBuddy replies
with Markdown, a collapsible progress row, reply actions, and a fixed bottom
composer. There is no floating robot or promotional reward banner. The project
editor remains available from the title bar and generated-file cards.

- Office tasks use authenticated `POST /api/chat` and display actual SSE content
  as it arrives. Code/design tasks still use project generation and save generated
  files before offering the editor. Conversation state is stored in this browser,
  not synchronized across accounts or devices.
- The **右侧预览** panel in the task title bar is **open by default** when a task
  opens (except at ≤680 px, where the panel would cover the conversation); the
  title-bar button or the panel's × button closes it again. It also opens by itself
  when the assistant generates project files. The panel renders the project files that are
  already stored in this browser inside a sandboxed iframe (`allow-scripts`, no
  same-origin access), so it shows the real page without a build step, a preview
  worker or network access. Device presets, refresh and “打开编辑器” are available;
  tasks without web output show an explicit empty state instead of a fake page.
- The progress row shows request/response status and measured elapsed time, not
  private model reasoning. “深度思考” is reference UI wording, not a guarantee that
  the selected provider exposes or enables a special reasoning mode. Answers,
  duration and returned model metadata are not hard-coded from the screenshot.
- Stop aborts the request and retains partial content. Retry replaces the latest
  reply without duplicating its question. Refresh preserves completed replies and
  marks interrupted requests as stopped instead of silently restarting them.
  “仅本地” never sends an AI request; confirmation mode asks before each request.
- Reply controls support clipboard copying, local feedback, browser speech,
  shareable text and Markdown export. Search and task history work locally.
  Attachments support bounded text files only; microphone input is explicitly
  marked as not connected. Markdown does not execute raw HTML or load remote images.
- The chat endpoint requires the existing authenticated API deployment and an
  OpenAI-compatible streaming provider configured with `AI_API_KEY` (or
  `OPENAI_API_KEY`), optionally `AI_BASE_URL` and `AI_MODEL`. The AI settings panel
  can also supply a session-only key for a supported provider at its fixed endpoint.
  No provider key is saved in conversation storage. Static hosting / Vite alone
  cannot supply AI replies; missing configuration is shown as an error, not a
  simulated answer. Real external-provider connectivity has not been verified here.
- Run `pnpm --filter designbuddy-web test:conversation` for conversational UI
  regressions, `pnpm --filter designbuddy-web test:right-preview` for the
  right-hand live preview (task conversation and editor split), `pnpm --filter designbuddy-web test:ui` for all reference pages, and
  `pnpm test:chat` for server validation, authentication, provider selection,
  streaming and cancellation checks. These tests mock the AI provider.

## Sidebar settings (references 12 and 13)

The shared username/portrait now opens a compact **设置** entry, replacing the
previous promotional account menu. Settings opens a modal gray window with
14 grouped navigation items, search, and a red close control. The general page
follows reference 12; choosing **模型** shows reference 13's custom-model card.
The window is available from every shared sidebar route and with Ctrl/⌘ + comma.
Escape, backdrop dismissal, keyboard focus cycling/return, and independently
scrollable narrow-screen navigation/content are supported.

- Font size (task input and reply text) and Markdown link-opening strategy are
  real, persisted browser preferences, under `designbuddy.preferences.v1`.
- Custom models support add/edit/confirmed removal, validation, and up to 20
  browser-local entries. Their actual model IDs appear in both home and task
  selectors. Removing an entry resets a selected home model, but preserves the
  model ID in existing tasks. Saving never sends a generation request or claims
  the model is supported by the configured provider.
- The AI service/provider is shared with the existing generation configuration;
  keys remain session-only, not in the persistent model list. This website does
  not write `~/.workbuddy/models.json` or install models locally.
- **个人主页** renders the plan panel directly inside the settings window: a
  gradient plan banner (`Free` · 订阅状态：免费 · 升级), a wallet card (`$0.00`,
  当前可用余额, 自动充值 with a disabled switch) and a quota-reset card (可用 0 ·
  暂无可用重置额度). Every number is the real state: payment, wallet, auto-recharge
  and cloud quota services are not connected, so the balance stays `$0.00`, the
  switch cannot be turned on, and each card's footnote says so. 升级 opens the same
  “付费套餐暂未接入” notice used by the profile page. The existing 后台连接状态 and
  账号与数据 entries are unchanged, so the section keeps its real destinations.
  The layout follows the 2026-10-18 reference screenshot; see
  `docs/verification/settings-profile-2026-10-18/`.
- **套餐与积分** now shows a credits panel above the honest local usage card: edition
  row (免费版 · 升级套餐), 总剩余积分 with the 套餐基础积分 / 平台奖励积分 / 购买积分
  breakdown, then 积分明细 rows with refresh/expiry times, used ratios and progress
  bars, and a 查看明细 link to the profile account page. **The values in that panel
  are the static reference content from the 2026-10-18 screenshot, not live data** —
  this build has no credits, subscription or payment service, so nothing can be
  granted, spent, recharged or billed. 升级套餐 still opens the real
  “付费套餐暂未接入” notice. The local usage card below (设计项目 · 任务对话 · 模板副本 ·
  模板修改状态 · 自定义模型 · 本地存储占用) keeps its real browser statistics and its
  “不会产生订阅或扣费” note. See `docs/verification/settings-plan-credits-2026-10-18/`.
- **外观** follows the 2026-10-18 reference screenshot: an 界面样式 heading with a
  hairline rule, three clickable 跟随系统 / 浅色 / 深色 theme preview cards, then one
  row per setting (title + grey help line on the left, control on the right)
  separated by the same gradient rules — 主题模式 (system/light/dark select plus a
  light/dark toggle button), 控制台主题, 链接打开方式, 语言, 字体风格, 内容宽度,
  文件图标, 模糊与玻璃效果, and 界面密度. **Every control is real** and writes to the
  local preferences store: 控制台主题 tints the skill workbench run log
  (`html[data-console-theme]`), 链接打开方式 shares `linkMode` with 通用, 字体风格
  switches the interface between sans-serif and serif, 内容宽度 caps task bodies and
  the composer (680 / 920 / 1320px), 文件图标 tints file icons by type or in one
  neutral grey, and 模糊与玻璃效果 turns the five `backdrop-filter` layers off. Two
  rows were renamed from the reference because the product has no terminal:
  终端主题 → 控制台主题 and 终端链接使用内置浏览器 → 链接打开方式. See
  `docs/verification/settings-appearance-2026-10-18/`.
- Lock-screen execution, wake prevention, startup, proxy management and trusted
  auto-install controls explicitly show their browser limitations and are disabled.
  Other unconnected account/plan/memory/device/security services explain their
  boundaries instead of fabricating success or modifying local projects.
- Run `pnpm --filter designbuddy-web test:settings` for popup layout, focus,
  persistence, CRUD, model request payload, secrets, storage errors, and responsive
  coverage. Tests mock the AI service; they do not verify external model access.

## Revised primary navigation

The shared sidebar is branded **DesignBuddy**. Its primary entries are now
首页 → 插件 → 模版 → 定时任务 → 更多. Home returns to `/` without clearing an
unsent prompt. Plugins opens `/plugins` using the existing official plugin
catalog; 模版 opens `/inspiration`, the template-based 灵感 page with search and
preview details. Both destinations retain the shared sidebar. `/library` keeps
its original multi-tab asset workbench.

Hovering 更多 opens a right-side flyout with 专家, 技能 and 连接器 on separate
rows. A short hover grace period lets the pointer cross into the flyout. Click/
touch, keyboard navigation, Escape and outside dismissal also work; small-screen
menus stay inside the viewport. Projects remain reachable through the task list
and the top sidebar utilities. Scheduled execution is still not connected and
its entry explains that limitation rather than creating a fake scheduled job.
Run `pnpm --filter designbuddy-web test:sidebar` for these navigation regressions.

## Redesigned plugin marketplace

`/plugins` now uses its own `PluginsPage.tsx` / `plugins.css` rather than the
asset library's generic color-strip cards. The DesignBuddy sidebar is retained.
The light editorial layout includes a green design-tools feature, a personal
toolbox feature, category-colored icons and a responsive three/two-column grid.

- **精选发现** curates 12 existing capabilities; **全部插件** retains all 480
  catalog definitions with Chinese category filters, case-insensitive search,
  name sorting and 24-item pagination. **我的清单** filters saved plugins from
  the existing `designbuddy.workspace.v1` store, so previous saves are retained.
- Search supports Cmd/Ctrl K, clearing and helpful empty states. Feature links
  open the relevant category or saved list instead of being decorative buttons.
- The native detail dialog displays the real catalog version, permission codes,
  risk label and adapter requirement. Escape/backdrop dismissal, focus trapping,
  focus restoration and small-screen scrolling are supported.
- Saving/removing a definition never installs software, grants permissions or
  executes a plugin. There are no fabricated popularity/download counts. The
  adapter requirement is explicitly disclosed. Storage errors roll back the
  in-memory save and show a failure message; these are local browser bookmarks,
  not account-synchronized installations.
- `/library` remains the separate multi-asset catalog. The detail dialog can
  navigate to the existing connector page without implying an account is linked.
- Run `pnpm --filter designbuddy-web test:plugins` for layout, filtering,
  pagination, persistence, permission disclosure, modal keyboard behavior,
  storage failure and 320–1440 px regressions.

## Community: nine work formats, fourteen samples

`/inspiration` retains the supplied community reference's category pills,
three-column previews and DesignBuddy sidebar. The previous 21-case / 24-screen
universal workbench has been removed: changing a category must change the actual
work format, not just the website's colors and labels. The collection now contains
**fourteen samples**: the original eight (two per original format, 160 pages/artboards),
plus one working sample each for HyperFrames, video, audio, live artifacts and WebGL,
and FORME, the first new prototype in the 180-template expansion.
The type filters are ordered 全部 → 原型 → 幻灯片 → 文档 → 图片 → HyperFrames → 视频 → 音频 → 实时产物 → WebGL. The separate 130-item asset specification catalog remains at `/library`.

| Route | Actual format | Scope and operations |
| --- | --- | --- |
| `/inspiration/travel` | Travel booking website prototype | 20 linked business pages: search, destinations, attractions, stays, rooms, dates, itinerary, travelers, confirmation, simulated payment, orders, favorites, guide and consultation. No real reservations, payments or messages. |
| `/inspiration/luma` | 16:9 presentation | 20 SVG slides from a shared scene description, thumbnail and keyboard navigation, viewport presentation mode (Escape exits), title/body editing, per-slide notes. PPTX export preserves editable text/shapes and embedded JPEG pictures with source credits in notes—not flattened slide screenshots. |
| `/inspiration/research` | Paginated A4 methods report | 20 substantive sections/pages, directory navigation/search, paginated or continuous display, zoom, title/paragraph editing and local comments. Download structured JSON or use browser Print / Save as PDF. The print button detects overflowing edited pages and asks for shorter text rather than silently truncating them. No DOCX export is claimed. |
| `/inspiration/chishan` | Brand artwork collection | 20 separately composed SVG artboards: posters, menu, logo, packaging label, invitation, story, collage, sleeve, event, tasting card, palette, signage, thanks card, postcard and more. Native-size view, fit, pan/zoom, captions, accent color and favorites. Download embedded-image editable SVG, native-pixel PNG, or a ZIP of all 20 SVGs and photo credits. |
| `/inspiration/museum` | City museum booking prototype | 20 business pages with exhibition search/filtering, linked collection notes, curatorial stories, program calendar, ticket types, dates/time slots, visitor form, explicit simulation confirmation, immutable latest-reservation snapshot, demo pass, rescheduling/cancellation, favorites and local consultation. Reference photography is not presented as the actual venue; no real admission credentials, payment or activity registration. |
| `/inspiration/city` | WALK city-walking proposal | 20 new editorial slide compositions: brief, route diagram, time-allocation chart, accessibility matrix, recording cards, contingency plan and run-of-show. Independent blue/coral visual language, content and photography; reuses only the presentation player and editable-PPTX exporter. |
| `/inspiration/handbook` | Before You Go travel handbook | 20 practical A4 chapters with planning tables, checklists, writing spaces and source notes. Independent warm editorial page renderer; reuses document navigation, editing, annotations, overflow detection and printing. Advice is general; prices, policies and schedules must be checked against official sources. |
| `/inspiration/nature` | Field Letters nature photography posters | 20 new SVG compositions: photo posters, observation cards, book cover, banner, postcard, bookmark, seasonal foldout, palette, invitation and blank calendar. Independent images/compositions; reuses canvas controls and SVG/PNG/ZIP export. |

| `/inspiration/hyperframes` | NEXT FRAME motion storyboard | Four editable timed frames, color/text/duration controls, actual play/pause/seek and self-contained animated HTML export. HTML/CSS implementation, not a third-party HyperFrames engine integration or MP4 encoder. |
| `/inspiration/film` | LAKESIDE photographic film | Actual 18-second, 960×540, 24fps H.264 MP4; native playback, chapter seek and speed controls. Three editable subtitle cues update playback and downloadable VTT. MP4 download is the original silent film, not an edited render. |
| `/inspiration/sound` | SOFT SIGNALS audio identity | Original 8-second mono 22.05kHz/16-bit PCM synthesis; tempo/brightness/gain change actual samples, waveform and exported WAV. Native audio player; no speech/music-generation API or external recordings. |
| `/inspiration/live` | SCOPE live estimate | Editable service rows, quantities/prices, add/delete, discount and tax; cent-rounded local computation, contribution bars, safe CSV and independent interactive HTML. Not live market data, a contract or payment flow. |
| `/inspiration/webgl` | FORM material study | Native shaders render a procedural torus or sphere (4,096 triangles). Drag/arrow-key rotation, color/zoom, optional spin, transparent model PNG, geometry/normals OBJ and offline interactive WebGL HTML. GPU-unavailable/context-loss feedback and retry; OBJ has no shader material. |

| `/inspiration/forme` | FORME furniture procurement prototype | 24 distinct business pages; five new AI concept images; product filtering/configuration, comparison, saved favorites, draggable 2D room layout, doorway-width screening, cart, budget/delivery settings, validated contact form, simulated checkout with an immutable receipt snapshot and cancellation, inspection checklist, aftercare/consultation drafts. Editable local state, independent copies, 40-step undo/redo, six named local versions. CSV estimate, self-contained image/font-embedded HTML project snapshot, JSON records and TXT drafts. No payment, inventory reservation, shipping, vendor or calendar integration. |

- Community thumbnails render the actual first website section, slide, document
  page or artboard, rather than unrelated marketing covers.
- The original eight samples use **44 distinct real photographs**: nine for travel and five per
  other sample, with **no cross-sample reuse**. Images are distributed according
  to the work's content, not padded onto every page. Files, sources, credits and
  per-photo license evidence are in `apps/web/src/assets/inspiration/` and
  `apps/web/src/assets/samples/` and `apps/web/src/assets/expansion/`. Credits are visible inside every sample and
  retained in relevant exports. No remote placeholder-image service is used.
- All brands, reservations, prices, events and product claims are demonstrations.
  The report explains observation methods using open images, not new experiments,
  clinical findings or medical advice. Its chart values are explicitly illustrative.
- **做同款** creates an independent same-format local copy at
  `/inspiration/:sample/draft/:uuid`, accessible from 我的副本. It does not turn a
  presentation or artwork into an HTML website. State is validated on load;
  malformed storage is discarded field-by-field. Copies and edits remain local
  to this browser, not synchronized to an account or collaborative backend.
  Storage failures show an export recommendation. Keep exports as backups.
- Fixed-layout artwork/PPT text may shrink to fit. SVG/PPTX text remains editable
  and uses installed fonts (Office may substitute fonts); PNG is a raster image.
  Presentation mode fills the app viewport, not the browser's Fullscreen API.
  Browser printing supports the report's fixed A4 pagination; unusually long
  edited sections should be shortened before sharing.
- `pnpm --filter designbuddy-web test:inspiration` checks the original four
  work formats and all 160 pages/artboards, both complete booking flows, notes/edits,
  actual PPTX/SVG/PNG/ZIP contents, two 20-page PDFs, copy isolation, photo-set
  separation, corrupted storage, retired routes and 320–1440 px layouts.

### Media assets and boundaries

- All five media samples support editable local parameters, reload restoration and independent **做同款** copies. They do not automatically play, upload, publish, call a generation service or sync to a server. Clearing site data removes saved edits.
- Film input consists of the existing AI-generated concept images `assets/scenes/hotel.webp`, `suite.webp` and `interior.webp` (under `apps/web/src/`), with procedural pan/zoom and transitions. These are not footage of a real hotel. The poster and MP4 are bundled in `apps/web/src/assets/media/`.
- `soft-signals.wav` is original additive sine/harmonic synthesis using C E G C G E D C, no human voice or sampled recording. `media-utils.ts` computes the same baseline and regenerates PCM for user parameters. Video has no soundtrack.
- Rebuild bundled assets from the repository root with `python -m pip install --target .cache/media-tools Pillow imageio-ffmpeg`, then `PYTHONPATH=.cache/media-tools python scripts/generate-media-samples.py`. The script uses imageio's FFmpeg binary; the Linux runner needs DejaVu Sans for the film's rasterized Latin lettering. It makes no network requests at generation time.
- `inspiration-media.spec.ts` checks real playback/cues, downloaded MP4/WAV signatures and PCM changes, independent HTML execution with network blocked, arithmetic, OBJ/PNG output, WebGL pixels/fallback, persisted copies and 320/375/768/1440px layouts. WebGL availability depends on the browser/GPU; MP4 playback depends on its H.264 decoder. Platform codec failures have explicit download guidance.

### 180-template expansion — local production started

The user approved starting implementation in the current workspace: **20 additional templates in each of the nine categories**, 180 additions overall. Every new template, including video/audio/motion/WebGL, must have 20–30 substantive content pages. Target final collection size is 193, not 180. This is ongoing work, not a completed batch.

- `docs/plans/community-180-manifest.json` records 180 unique proposed projects. Planned titles are not published cards and do not count as working templates. Their detailed content and assets still need to be designed.
- `docs/plans/community-180-progress.md` records delivered features and actual verification. FORME, ATELIER, ROOTS, DAYLIGHT, TIDE and MORROW (24 pages each) are implemented and verified; 174 other templates remain unimplemented.
- FORME's images are new generated concept imagery, not real products or merchant claims; provenance is in `apps/web/src/assets/forme/SOURCES.md`. Its editor is route-lazy-loaded, while its community preview remains lightweight.
- Furniture finish/fabric choices change configuration and pricing, not the generated photograph. The 2D planner does not detect collisions; doorway checking is a single-width screening tool, not an entry guarantee. Exported HTML is the current project document, not source for the full prototype. Only the most recent local demo receipt is retained, with confirmation before replacement.
- Named versions are isolated per sample/copy and stored separately; creating a copy transfers current editable state, not the original's version history. Contact fields and receipts remain in browser storage; exported files may contain them. Clearing current contact fields does not redact historical receipts or previously downloaded files.
- The current coding session is closed for remote GitHub operations. Changes are local, not pushed or merged; publishing must happen in a new coding session after safely carrying over all unpushed work.

The existing project editor's **交互模式** remains available for HTML projects.
The default element-selection mode is preserved; interaction mode removes the
selection click interceptor without changing sandbox permissions. The fourteen
samples have their own type-specific editors and do not use that HTML sandbox.

For meaningful Chinese visual/overflow tests on a minimal Linux runner, install a CJK font (for example Noto Sans SC) before launching Chromium. Fonts in SVG/PPTX remain text, not outlined glyphs.

## Homepage design concepts

Static homepage explorations are archived in [docs/design/homepage](docs/design/homepage/README.md): five initial directions and fifteen minimalist conversation-home concepts, with original PNGs and numbered PDF collections. These are design references only; they have not replaced the implemented homepage.

## Homepage based on reference 27

The homepage right-hand canvas now follows the supplied `27.png` composition: a typographic hero with a decorative D orbit, a wide task composer, five quick entry cards, and five popular-scene cards. The shared left navigation is unchanged; its background remains `#f2f2f2` and the right canvas is plain white. Color gradients are confined to the title, send control, and illustration, not the page background.

- Existing office/code/design modes, text attachments, model selection, workspace and execution-policy controls are retained. Additional original shortcuts remain under “更多快捷场景”.
- Quick entries prefill an editable prompt within the current mode. Scene cards open an interactive preview; “使用此场景” transfers a prompt only after confirmation when needed. Neither action automatically sends a request, fabricates a generated image/PPT, or implies an unconfigured adapter is connected.
- “查看更多” opens the inspiration library; “探索更多 AI 能力” opens the plugin market. Header controls open existing project/workspace controls and show the actual local notification status.
- Desktop scrolling is confined to the right canvas so the unchanged sidebar account entry remains visible. On small screens the existing shared mobile navigation is retained, with responsive two-column cards.
- Homepage regression checks: `pnpm --filter designbuddy-web test:home` (original interaction checks plus reference-layout, task-prefill, route and 320–1440px overflow checks).

### Homepage model menu (reference 5)

The model trigger stays immediately left of voice input. Its compact 340px popover opens upward when space permits and aligns to the trigger's right edge. Max mode, vertically stacked reasoning choices, monochrome model marks, reference badges/rates, the selected check, and the custom-configuration entry follow reference 5. The panel clamps to the viewport when resized and supports keyboard model navigation, Escape, outside-click dismissal, and focus restoration.

Reference promotions/rates are not billing quotes; tooltip text discloses this. Max and reasoning controls are interface preferences only and do not claim to change backend inference settings. The custom-model entry opens the model settings window directly. Regression coverage is included in `test:home` (`model-menu.spec.ts`).

### Composer add menu (reference 6)

The left plus control now opens a two-level menu with 添加文件 / 模式 / 专家 / 技能 / 连接器, and changes into a close control while open. Desktop hover or click reveals an adjacent searchable catalog; compact screens use a single panel with a back action. The menus stay within the viewport, support keyboard navigation/Escape, close on outside interactions, and exclude the model popup.

- File selection reaches the existing native picker and text-attachment reader. PDF/image parsing limitations are disclosed before selection.
- Mode selection synchronizes the existing homepage tabs. Experts and skills reuse real local catalogs (including saved custom entries), update the selected task context, and do not automatically submit or execute anything.
- Connector choices open the existing detail/configuration route, never auto-authorize. Footer links open the full expert, skill, or connector catalogs.
- Ten additional regressions in `attach-menu.spec.ts` cover selection/context handoff, upload, search, keyboard/hover, service boundaries and 320–1440px menus. Included in `test:home`.

### Neutral homepage refinement

The homepage now uses gray/white styling without the decorative hero image,
colored icon backgrounds or gradient headline/send control. The specifically
requested “AI×创意×效率” and “DesignBuddy 让创意更简单，让工作更高效。”
copy is displayed in neutral gray at 14px. Workspace/permission selectors and
their options, the current model name and all three mode labels also remain
14px across desktop and mobile breakpoints. Large centered mode controls, mode-specific shortcuts, interactive scene previews and all existing
task/workspace/attachment controls remain functional. The shared sidebar
is unchanged apart from the requested username settings entry.

### Mode-specific shortcuts and interactive scene gallery

The active home mode controls both rows: five office, five development, or five
creative shortcuts, plus five matching popular scenes (15 demos total). Mode
changes preserve input, attachments, model, workspace and execution policy. A
shortcut never changes to another mode or sends a request. Replacing a nonempty
prompt requires confirmation; choosing Cancel preserves both the input and any
open preview. Additional legacy shortcuts are filtered by the active mode too.

Popular cards render the actual scene, not decorative icons. Opening one now enters
an **editable local workspace immediately** — no “功能试用” unlock and no reset on
close. The 15 products retain their separate layouts, typography, backgrounds,
photography and task-specific controls. Outer DesignBuddy chrome remains neutral.

#### Local workspaces and delivery

- Automatic browser storage, save status, close/reopen recovery, undo/redo (up to
  60 session snapshots), up to 10 named versions, field-by-field version comparison,
  restoration and complete JSON backups. Undo history itself does not survive reload.
- A 450ms autosave debounce and grouped typing history; a multi-field event is one
  undo operation. Closing explicitly flushes changes. Quota/permission failures keep
  the live draft and offer backup rather than claiming success. Malformed data is
  not overwritten without explicit recovery. Concurrent tabs pause on conflicts.
- Desktop/tablet/mobile artwork widths, keyboard focus trap/return, Escape/backdrop
  dismissal, visible focus and reduced-motion support. Reset and destructive actions
  ask for confirmation. “使用此场景” still fills only the prompt and never sends it.
- Each delivery desk lists the actual file type, complete content/versions backup,
  print/save-PDF, source/font notices and offline usage instructions. JSON is a data
  backup, not executable code; arbitrary project JSON import is intentionally absent.
- DOCX and XLSX are actual OOXML ZIP packages; PPTX uses PptxGenJS with editable text,
  tables, charts, embedded pictures and speaker notes. PDF is explicitly the browser's
  print/save-PDF flow, not a simulated direct PDF download.

| Scene | Editing and workflow | Actual outputs |
| --- | --- | --- |
| Meeting | Discussion, decision, actions, owner/date, completion and meeting source | Markdown, DOCX, print/PDF |
| Weekly | Team/project/source, previous-period comparison, targets, risks and next steps | Text, DOCX, print/PDF |
| Sales | CSV/XLSX import, editable cells, sorting/filtering, linked totals/charts | CSV, XLSX |
| Slides | Per-page title/body, six layouts, image upload/crop focus, add/delete/reorder, notes and playback | Real PPTX |
| Email | Independent drafts, recipient/body/signature, attachment add/remove, device preview and validation | MIME EML draft with attachments |
| Corporate site | Three-page navigation, on-artwork title/intro editing, uploaded hero, contact validation | Standalone HTML front-end delivery |
| Operations | Orders plus product/customer CRUD, manual inventory, low-stock alerts, summaries, read-only mode and import | CSV exports, project JSON |
| API | Named request collection, orderId variable, status query, JSON validation, identity and reloadable response history | JSON collection and project |
| Debugging | Three predefined issues, source comparison, local execution before/after fix | Source file, unified patch, JSON record |
| Tests | Two built-in functions, eight seed assertions, user-defined numeric cases, failures and reruns | JSON report |
| Hotel app | Room names/prices, favorites, date/guest checks, pricing, saved itinerary drafts and continued editing | Project JSON, print/PDF |
| Architecture | Pages, editable project title/copy, image upload/focus, intro block reordering, category/detail and theme | Standalone HTML with project pages |
| Poster | Direct text editing, pointer/keyboard object movement, alignment guides, photo upload/crop, color/type/three sizes | PNG, SVG with embedded image/font subsets |
| Brand | Identity, palette/type, genuinely linked vector packaging, card/letterhead/label and guidelines | ZIP with SVG assets, guide and font license |
| Campaign | Audience/objective/strategy, draggable calendar, owner/date/title/status, weighted channel budget | Execution/budget CSV, DOCX |

Import limits: CSV/XLSX up to 1,000 records; uploaded table files up to 2 MB and ZIP
expansion up to 10 MB. The first XLSX worksheet is read; formula cells are rejected
rather than trusting cached values. Headers/identifiers/numeric bounds are validated.
Sales channels are the three documented channels in this example's data model.
CSV quoting and formula-prefix escaping protect exported text cells.

Image uploads accept PNG/JPEG/WebP up to 8 MB, resize to 1,200px and compress locally;
large results are rejected. Email attachments are limited to 250 KB each, five files
and 600 KB total per draft. Browser storage quota is still finite; image-heavy named
versions can exceed it and will show an actionable error. Keep offline backups.

#### Sources and honest boundaries

Eight original **AI-generated concept images** are local under `assets/scenes`; see
its README. The brand hero now uses actual editable vectors rather than recoloring
an unrelated photograph. These assets are not proof of real clients, bookable hotels,
product performance or trademark clearance. Uploaded assets remain the user's
responsibility. `assets/fonts` includes Noto Sans SC regular WOFF2 Unicode subsets,
its source/version and SIL OFL 1.1 license. Poster and brand SVGs embed only needed
subsets and their license; Office files retain editable text and use system fonts.

All mutations are **local to this browser**, not a production backend or cloud sync.
There is no email sending, real reservation/payment, ad placement, shipping, AI
inference or actual external API request. Inventory is a separate manual ledger;
changing order status does not decrement stock. Read-only mode demonstrates UI
permissions, not server authorization. Debug/tests run only the displayed built-in
functions, not arbitrary uploaded repositories or user JavaScript. Exported websites
are standalone front-end delivery editions, not the workspace/editor application;
contact forms only validate locally. JSON backups are not arbitrary-code projects.

Validation: `pnpm --filter designbuddy-web build` and
`pnpm --filter designbuddy-web test:home` (78 tests) pass. The scene-specific command
`pnpm --filter designbuddy-web test:scenes` includes all 15 workflows, 320–1440px
bounds, prompt/context preservation, storage failures/conflicts, version recovery,
CSV→XLSX roundtrips, PPTX/DOCX contents, image/vector downloads, CRUD and offline HTML.
The OOXML tests inspect generated archive structure/content; they are not a claim
of pixel-identical rendering in every proprietary Office application. Vite still
reports the existing large-main-bundle warning; PPTX generation is lazy-loaded.


### ATELIER — bespoke tailoring prototype

`/inspiration/atelier` adds an independently designed 24-page oxblood/charcoal
fashion workspace. It includes garment configuration, measurement checks,
ease and quote calculations, technical SVG, fitting notes, immutable local
confirmation snapshots, sequential manual production tracking, undo/versions,
server backup and JSON/CSV/SVG/TXT/offline HTML export. Five dedicated AI concept
images and their disclosure live in `apps/web/src/assets/atelier/SOURCES.md`.
This is not a real tailor, order/payment system or production pattern generator.

Run `pnpm --filter designbuddy-web exec playwright test inspiration-atelier.spec.ts`
for the 13 dedicated checks; the combined community/backend regression has
101 passing tests. That batch reached 2/180; the current expansion status is **6/180 added, 174 still unimplemented**, as documented below.


### ROOTS and DAYLIGHT — two additional 24-page interactive prototypes

- `/inspiration/roots`: a garden-planning studio with five dedicated AI images,
  plant/light filters, scale-plan coordinates and bounds, soil/volume/bag/water/rain
  calculations, budget, care logs, sequential checks and frozen local review.
- `/inspiration/daylight`: a coworking-space planner with five different AI images,
  half-hour desk capacity and exclusive-room conflict checks, team seating,
  local arrivals/guests/events/tickets, explicit billing modes, frozen estimates,
  a timestamp-based focus timer and power × time energy scenarios.
- Both support isolated editable copies, undo/redo, named local versions, JSON
  recovery, real CSV/SVG/24-chapter offline HTML, and actual account-backed snapshot
  restoration in another browser. DAYLIGHT also exports timezone-aware ICS with
  stable event IDs, UTF-8 folding and escaping. No real reservations, purchasing,
  access control, notifications or payments are performed.
- Verification: **128/128 combined community/backend browser tests**, including
  **27 new specialist tests** (12 ROOTS + 15 DAYLIGHT). After the final mobile-header
  refinement, those 27 tests passed again. Each template's 24 pages were checked at
  320/375/768/1440px, including actual desktop/mobile/offline CJK visual review.
  Domain model tests: 12/12; backend Node tests: 8/8; web and API builds pass.
- Run domain checks with
  `node --experimental-strip-types --test scripts/prototype-domain.test.mjs`.
  Browser checks: `pnpm --filter designbuddy-web exec playwright test inspiration backend.spec.ts`.
- That batch reached **17 works** (13 original + 4 verified additions). The complete
  target remains 180 additional templates, not 180 catalog placeholders. Current
  status is recorded in the latest batch below. No GitHub push or merge was performed in this closed session.


### TIDE and MORROW — sailing club and specialty coffee prototypes

- `/inspiration/tide`: 24 substantive pages, five dedicated images, boat/time overlap
  guards, monthly planning quotas, cancellation, monthly cost calculations, learning
  and sailing logs, weighted pace, a non-geographic diagram, frozen discussion and
  unverified contact TXT. No navigation, weather service, qualification verification,
  emergency calling or actual sailing clearance is offered.
- `/inspiration/morrow`: 24 substantive pages, five different images, weighted blends
  gated at 100%, independent cart and four-cycle plans, date arithmetic, skipping and
  rotation, pause/resume, exact pour allocation, chronological SVG chart, manual
  nonnegative inventory, after-discount shipping thresholds and frozen estimates.
  No real subscription, merchant inventory, payment or shipment is performed.
- Both provide isolated editable copies, local undo/redo and named versions, actual
  account snapshots and separate-browser restoration, JSON round-trip, CSV, embedded
  CJK SVG and fully offline 24-chapter HTML. Each has its own visual layout and model.
- Verification: **157/157 combined browser tests**, including **TIDE 14 + MORROW 15**.
  All 24 pages at 320/375/768/1440px; actual desktop/mobile/offline visual review;
  domain tests **24/24** (12 previous + 12 new); backend Node **8/8**; web/API builds pass.
- Domain command: `node --experimental-strip-types --test scripts/*-domain.test.mjs`.
- Actual catalog: **19 works**, with **6/180** requested additions verified and **174
  unimplemented**. Next planned item: STUDIO NINE. Existing work is preserved on the
  session branch. No GitHub push or merge was attempted in this closed session.

### Advanced expert execution status (2026-10-16)

Two bounded real file tools are now registered: scanned-PDF per-page Chinese/English OCR (`pdf.ocr`) and exact two-sheet XLSX joins (`table.join`). The latter includes a downloadable real workbook example and explicit sheet/key parameters. These are partial additions, **not completion of all 12 experts' advanced capabilities**. See the [full advanced implementation ledger](docs/plans/advanced-experts-execution.md) for boundaries, all remaining tasks, dependencies, and executed verification. `pnpm test:skills` covers every server skill test file.

The next verified batch adds bounded workbook formula recalculation (`table.calculate`, cached values never used) and atomic multi-PDF OCR from a ZIP (`pdf.ocr-batch`, 2–3 PDFs, six pages total). See [implementation boundaries and verification](docs/plans/formula-batch-execution.md). There are now 16 executable tools; full expert capabilities remain incomplete.

The third verified addition, `document.structure`, extracts bounded DOCX body structure, merged tables, and embedded raster images into JSON/HTML/XLSX/image ZIP artifacts. Chinese preview fonts are embedded with their license. This is **not original Word pagination or full layout restoration**. See [scope and verification](docs/plans/docx-structure-execution.md). At that stage the runtime exposed 17 implemented tools.

The fourth advanced batch, `infographic.compose`, turns explicitly declared comparison, trend or composition goals and bounded JSON data into actual SVG/PNG information graphics, KPI calculations, provenance and hash reports. It preserves original JSON numeric lexemes to avoid silent binary-float rounding. **Deterministic goal-based rules are not AI business-semantic understanding or freeform infographic design.** That batch brought the runtime to **18 implemented tools** across the same 12 experts. See [scope, examples and exact test sequence](docs/plans/infographic-execution.md). Final server regression: 113 passing; catalog: 9 passing. The expanded browser run initially had 475 passing / 3 stale assertions failing / 1 FFmpeg-dependent skip; after correcting those assertions and the numeric precision handling, all 28 related rechecks passed. This is not a claim of a clean single-pass 479/479 run or completion of all advanced capabilities.

### Optional offline English audio transcription — fifth advanced batch

`audio.transcribe-en` genuinely decodes **0.5–15 second, mono 16-bit PCM 16kHz WAV** with pinned PocketSphinx 5.1.1 assets. It produces actual TXT/SRT, word-level timing and approximate scores, a playable audio review page, source/model hashes and licenses. Explicit English-language confirmation and upload consent are both required; this tool is manual-only, does not automatically detect language, and is **not Chinese/multilingual/long-meeting transcription**. All words require listening review; scores are not accuracy.

On **Linux x86_64 with Python 3.11**, run `python3 scripts/setup-asr.py` (or `pnpm setup:asr`) before starting the server. The installer verifies a pinned PyPI wheel and actual audio recognition; runtime requests never download models or send audio to an external recognition provider. Model assets live in ignored `data/skill-models/asr-en-v1/`, not Git. For a custom directory, provide the same `DESIGNBUDDY_ASR_ROOT` environment variable to setup and the server; the Python setup script does not read `.env`. Missing or modified assets disable this skill without disabling the other tools. At the fifth/sixth-batch checkpoint this brought the total to 20 (19 without ASR); the seventh batch below now brings it to **21 implemented tools**, ready totals are 21 with ASR and 20 without it.

The API owns and reaps native recognition processes on cancellation, worker failure, deadlines and shutdown; resource bounds are not a general-purpose OS sandbox. Fifth-batch validation: **123 server tests, 167 related browser tests (not the whole-site suite), and 9 catalog tests passed**. See [full scope and exact test sequence](docs/plans/english-audio-transcription.md) and [saved artifacts/evidence](docs/verification/english-asr-2026-10-16/). No push, production deployment or updated cloud backup is implied.


### Layer-based poster editing and actual export — sixth advanced batch

`image.layout` adds real text/rectangle/raster-image editing to the marketing expert: pointer move/resize, coordinates, layer order/visibility/locks/opacity, copy/delete, 20-step undo/redo, three canvas presets, and editable JSON download/import. Preparing the current canvas does not upload it; separate consent is required. Any project edit invalidates the staged file and consent. Drafts are **memory-only**, not autosaved; download JSON before navigating away.

The backend actually decodes images, corrects EXIF orientation, outlines local Noto glyphs, checks visible text overflow, and renders PNG/SVG. It delivers six artifacts including editable JSON, source/render hashes, font license and execution receipt. Strict input and pixel budgets apply; no remote assets, arbitrary SVG, PSD, AI image generation/retouching or publishing. Source declarations are not independently verified. **JSON retains hidden layers/original image metadata; SVG crops retain the full normalized image. Neither is a redaction mechanism.**

Current verification: **136 server tests, 175 unique related browser tests, and 9 catalog tests passed**, no skips. Browser coverage ran as 169 tests plus the separately restored six-test infographic suite; final layout-only eight tests passed again after additional screenshot/identity-race assertions. This is not full-site or 36-business-case acceptance. TypeScript and production build passed; existing bundle warnings remain. See [scope, limits and reproduction](docs/plans/poster-layout-execution.md) and [durable artifacts, screenshots, logs and hashes](docs/verification/poster-layout-2026-10-16/). No push, deployment or updated cloud backup.


### Brand system and logo assets — seventh advanced batch

`brand.system` accepts a strict structured brief and uses real local Noto glyph outlines plus three finite geometric mark recipes (`seed`, `orbit`, `spark`). The backend produces an actual symbol and lockup SVG, decoded 64px and 512px PNG icons, a 3–5 color token/CSS set with calculated black/white contrast, a design-system JSON, responsive HTML guidelines (with only the required Noto WOFF2 subsets embedded for offline Chinese rendering) and font-license text. Output is generated by the actual worker and owner-isolated artifact store.

This is a useful, editable-in-source **template-based brand-system draft**, not AI creative direction or bespoke logo design. It does not search trademarks or copyrighted marks, test market differentiation, certify registration, verify a brand’s claimed rights, conduct audience research, or promise product-wide accessibility. Review the name, geometry, color, culture, font fallback and licenses before use. See [scope, input contract and limits](docs/plans/brand-system-execution.md), plus [the isolated worker's real eight-file result and hashes](docs/verification/brand-system-2026-10-16/).

The tool count is now **21 implemented** (20 ready when the optional English ASR model is not installed; 21 with it). Ten brand tests cover validation, hostile text, three marks, raster decoding, deterministic changes and actual owner-only worker artifacts. **136 non-ASR backend tests**, **1 real brand-workflow browser test**, **9 catalog tests**, frontend/backend TypeScript and production build passed. The browser test downloaded all eight skill outputs, verified the ninth service receipt, checked embedded-font availability, and captured desktop/mobile guideline screenshots. ASR's optional suite is unavailable here because its ignored local model is absent; its full-suite failures are documented and are not counted as passed or skipped. This is not full-site browser or 36-business-case acceptance. This remains a bounded subset, not completion of all brand or expert capabilities.


### Multi-file, multi-step table joins — eighth advanced batch

`table.join-multi` gives the data expert an actual bounded cross-file join workflow. A ZIP can contain 2–5 UTF-8 CSV files plus an explicit `joins.json`; the backend performs 1–4 ordered left/inner/full joins, enforces a unique nonblank right key, bounds row/cell growth, and outputs an actual XLSX with a separate source-file/source-row lineage sheet plus a rules report. ZIP metadata, CRC, paths and expanded-size limits are verified before decompression. Formula-looking CSV cells remain literal text; no uploaded formulas execute.

This does **not** infer business meaning or key relationships, discover composite keys, expand one-to-many relationships, compute business metrics, connect external databases, or certify the data. See [the exact input contract, limits and checks](docs/plans/multi-file-table-join.md) and [the downloaded worker output, hashes, logs and isolated-service evidence](docs/verification/multi-table-join-2026-10-16/README.md).

Verification for this batch: **11 backend cases, 147 non-ASR server/API regression cases, 1 real UI-to-worker browser flow and 9 catalog tests passed**; TypeScript, production build and diff checks passed. The browser case uploads the included three-file/two-step example, downloads the result, and checks source row provenance. This is not a full-site or business-case acceptance. At the eighth-batch checkpoint: **22 implemented tools; 21 ready without the optional English ASR model, 22 when installed**. (Current count and latest work are recorded below.) The Chinese/multilingual/long-meeting transcription and the other listed expert capabilities remain in progress, not marked complete.


### Document semantic summary — ninth advanced batch (provider-dependent, not fully acceptance-tested)

`document.summarize` is wired to the server's configured OpenAI-compatible AI service for TXT, Markdown and DOCX paragraph text. The user must separately agree to app upload and, through a skill-specific control, one-time third-party processing of the extracted body. The worker records model/input provenance, emits paragraph-reference labels, and fails rather than returning an empty or reference-invalid result. Without `AI_API_KEY`/`OPENAI_API_KEY`, the skill is unavailable. Requests reject redirects.

**These are partial steps, not completion of document understanding.** The DOCX structure preview now retains some directly declared indentation, spacing/line height, table grid widths, cell RGB shading and vertical alignment; it still does not restore inherited styles, page geometry/pagination, columns, headers/footers or floating-image wrapping, and is not compared with a native Word render. The PDF batch skill now processes 2–4 PDFs/8 pages per bounded run with a 120-second worker deadline; it is not resumable or unbounded. Summary still does not interpret OCR/images, flattened table relationships, and paragraph references do not prove semantic entailment. Four summary tests use mocked transport; no provider credential was configured for live acceptance. DOCX layout preview browser flow has been tested for this fixture, but no browser workflow has been verified for the cloud summary itself. No real-provider quality/privacy/latency test has been done. See [summary scope](docs/plans/document-semantic-summary.md), [DOCX limits](docs/plans/docx-structure-execution.md) and [the persistent real-worker OCR artifacts](docs/verification/pdf-batch-expansion-2026-10-16/).

The runtime catalog has **28 entries: 23 implemented skills plus 5 not-yet-connected placeholders**. Of the implemented skills, without either ASR model or AI key 21 are ready; either configuration alone makes 22 ready, and both make 23. The other expert capabilities and the remaining document/OCR/layout work are still in progress.

## Immersive welcome and builtin welcome templates

First-time visitors now see the selected **07 沉浸画廊** welcome. `/welcome` always reopens it; `/login` and `/register` use the same artwork and real password authentication. The footer switches between 简体中文 / 繁體中文 / English / 日本語 and persists the selection. Local AI / API key entries open model settings; visitors can explicitly explore without creating an account.

Google and GitHub sign-in reuse the server OAuth flow, but require operator-owned OAuth apps and server-only credentials; see `.env.auth.example` and `docs/verification/welcome-2026-10-19/README.md`. Neither provider is configured in the current preview, and a static GitHub Pages deployment alone cannot supply an auth backend.

The **模版 → 图片** library now includes all **15 welcome PNG templates**, with full preview/download, independent copies, usage notes and server snapshot save/restore. Original images and sources are kept in `designs/visitor-welcome/`.
