# 注册页直接进入输入框

日期：2026-10-20。

## 已实现

- 在登录/注册表单的主按钮下方新增“直接进入输入框”按钮。
- 不填写用户名或密码也可点击；直接打开首页并将焦点放到任务输入框，立即可以打字。
- 复用原有访客入口；不会自动注册、调用模型、提交任务，也不授予账号或管理员权限。
- 即使入口带有 `next=/admin`，直接体验也只进入首页，不转到该目标。正常登录注册的 `next` 流程保持原样。
- 浏览器允许存储时保留原有访客进入偏好；禁止写入该偏好时仍能在本次页面进入，不承诺刷新后保留。
- 按钮及说明支持简中、繁中、英文、日文。
- 只增加左侧控件；未修改背景图片、15张欢迎模板、OAuth配置或服务端授权。

## 证据

[注册页实际浏览器截图](./register-direct-entry.png)

前端 TypeScript + Vite 构建通过（仍有既有 fflate 混用和大包告警）。

以下5份 Playwright 测试共 **47项通过**，含新增8项直接进入测试、正常登录注册/会话回归、四语、320/390/768/1440布局，以及15张原图下载和模板保存回归：

```bash
corepack pnpm --dir apps/web build
cd apps/web
node scripts/run-playwright.mjs test \
  tests/auth-direct-entry.spec.ts tests/auth-layout.spec.ts \
  tests/auth-entry.spec.ts tests/auth.spec.ts tests/welcome.spec.ts
```

本轮验证没有进行真实 Google/GitHub OAuth 登录；相关模拟配置测试只证明界面和现有端点路由。正式服务器部署未包含在本轮操作中。
