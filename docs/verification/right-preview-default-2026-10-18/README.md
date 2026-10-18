# 右侧预览默认展开（2026-10-18）

把「右侧预览」从「需要手动点开」改成「进入就展开」，其余渲染逻辑与既有边界不变。

## 改动

- `frontend/workspace/pages/TaskConversationPage.tsx`
  - `previewOpen` 初始值改为 `previewFitsByDefault()`：视口宽度 > 680 px 时默认展开，
    ≤ 680 px（手机宽度，面板会盖住对话）保持收起，仍可用标题栏按钮打开。
  - 服务端对话恢复时改为 `setPreviewOpen((open) => open || restored.messages.some((m) => m.artifact))`，
    恢复历史不会把读者已打开的面板关掉，AI 生成文件后依旧自动打开。
- `frontend/workspace/pages/ProjectEditorPage.tsx`
  - 画布默认视图 `view` 由 `preview`（单栏设计预览）改为 `split`（右侧预览分屏，左源码右实时预览）。
  - AI 生成成功后 `setView("split")`，不再把分屏收回单栏。
- `apps/web/tests/right-preview.spec.ts`
  - 「还没有生成网页的任务…」改为断言默认展开后显示「本机项目草稿」并渲染真实草稿页面，再收起。
  - 新增一条：宽屏（1440）默认展开、手机宽度（390）默认收起且可手动打开。
  - 编辑器用例改为断言进入即分屏，再点「右侧预览」保持分屏、点「设计预览」回到单栏。
- `README.md`：同步「默认展开」与「≤680 px 例外」的说明。

## 验证

- `pnpm --filter designbuddy-web build`（`tsc --noEmit` + `vite build`）通过。
- `pnpm dev:full` 运行中，改动经 Vite HMR 生效（Web 5173 / API 8787）。
- **未在本环境执行** `pnpm --filter designbuddy-web test:right-preview`：这个沙盒没有
  可用的 Chromium（`@sparticuz/chromium` 解出的二进制缺 `libnspr4.so` 等系统库，且无
  root 权限安装），Playwright 浏览器下载域名也不在允许的网络范围内。
  新增/改写的断言需要在有浏览器的环境里跑一遍确认。

## 边界

- 预览仍是本机沙盒 iframe，不是构建产物或部署 URL；没有网络请求，也不读取项目之外的文件。
- 默认展开只影响界面初始状态：预览面板不猜内容，没有网页文件时依旧显示明确的空状态说明。
