# 右侧预览（2026-10-16）

本次把「右侧实时预览」真正接进应用，并保留仓库既有的诚实边界：预览只用本机已有的项目文件，不连接外部服务，也不谎称已构建或已部署。

## 代码检查结论

- `apps/web/src/features/preview/PreviewPanel.tsx` 与 `usePreviewSession.ts` 是**未接线的服务端预览面板**：它依赖 `/api/preview/sessions` 这套「隔离预览 worker」接口，而本地守护进程并没有挂载该路由（只有 `server/preview-worker/e2e` 用例挂过），直接启用只会一直报错。
- 应用里真正可用的预览能力在 `frontend/workspace/pages/ProjectEditorPage.tsx`：把 `index.html`、`src/styles.css`、`src/main.js` 内联成一份文档，放进 `sandbox="allow-scripts"` 的 iframe（`buildPreviewDocument`）。
- 任务对话页此前只有一句「可以打开项目编辑器查看预览和源码」，对话与作品是割裂的；`docs/design/expert-routing/方案与设计图.md` 的「执行工作台」也要求作品在右侧。

## 改动

- 抽出共用模块 `frontend/workspace/previewDocument.ts`（`buildPreviewDocument`、`hasPreviewablePage`），编辑器与新面板共用同一套渲染逻辑。
- 新增 `frontend/workspace/PreviewSidePanel.tsx` + `preview-side-panel.css`：桌面/平板/手机三档视口、刷新、打开编辑器、关闭；没有网页文件时显示明确空状态，不伪造页面。
- `frontend/workspace/pages/TaskConversationPage.tsx`：标题栏新增「右侧预览」开关；AI 生成项目文件后自动打开右侧预览；对话中修改文件后预览立即刷新。
- `frontend/workspace/pages/ProjectEditorPage.tsx`：画布新增「右侧预览」分屏，左源码右实时预览，原有「设计预览 / 源代码」标签与元素检查器保持不变。
- 响应式：≤1240px 面板收窄为 340px；≤1100px 面板停靠在标题栏下方，不遮挡标题栏操作；≤680px 铺满右侧。

## 验证

- `apps/web/tests/right-preview.spec.ts`（新增，4 项通过）：生成后自动打开并渲染真实沙盒页面、内联样式生效、来源标注为「AI 生成结果」；设备切换 / 刷新 / 收起重开；没有生成网页时给出明确说明；编辑器分屏同时显示源码与预览。
- 回归：`tests/conversation.spec.ts`、`tests/clarification.spec.ts`、`tests/home.spec.ts`、`tests/home-reference.spec.ts`、`tests/sidebar.spec.ts`、`tests/scenes.spec.ts`、`tests/model-menu.spec.ts`、`tests/workspace.spec.ts` 全部通过。
- 已知既有失败（与本次改动无关，基线同样失败）：`tests/task-skills.spec.ts` 中「task model proposal preserves explicit expert/model…」在自动匹配一步拿到「暂未完成匹配」。
- `pnpm --filter designbuddy-web build`（`tsc --noEmit` + `vite build`）通过。

## 截图

- `right-preview-task.png`：任务对话页右侧实时预览。
- `right-preview-editor.png`：编辑器「右侧预览」分屏。

## 边界

- 预览是本机沙盒 iframe，不是真实构建产物：没有 npm 安装、没有生产构建、没有部署 URL。
- 沙盒里的字体取决于运行环境；最小化 Linux 容器需要安装中文字体（例如 Noto Sans SC）才有中文渲染，与仓库既有说明一致。
- 面板不发起任何网络请求，也不读取项目之外的本机文件。
