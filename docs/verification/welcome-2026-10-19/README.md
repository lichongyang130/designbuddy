# 07 沉浸欢迎页与 15 套内置图片模板

日期：2026-10-19。用途：首次访问欢迎页与应用内模板，不是发布到外部社区。

## 实际实现

- 首次访问时，服务器确认是访客后展示 07 的暮色山湖背景、半透明卡片和品牌标题。已有账号直接进入应用；明确选择访客入口后会记住选择。随时可访问 `/welcome` 再次查看。
- `/login`、`/auth`、`/register` 使用相同的沉浸布局，连接现有真实账号密码接口，保留合法的 `next` 深链接。注册不会宣称所有收费功能免费，不添加虚假条款链接。
- Google / GitHub 按钮读取 `/api/auth/providers`，配置存在时进入现有 OAuth 授权端点；未配置或后端不可用时显示真实状态和重试入口。没有把按钮点击当成登录成功。
- 页脚原生语言选择器支持简体中文、繁体中文、English、日本語，复用现有 locale 设置，刷新保留；欢迎页、账号表单、OAuth 按钮、页脚同步切换。其他全局语言在此页回退英文；模板内的原始图片中文不会被假装翻译。
- “本地 AI”“API 密钥”打开实际模型设置；“先逛逛工作台”允许访客进入。没有安装本地模型，也没有替用户配置 AI 密钥。
- 模版入口 `/inspiration` → 图片：新增 `welcome-01`—`welcome-15` 共 15 张内置 PNG 模板。可完整查看、下载、记录备注、做同款创建独立副本、保存/恢复服务器版本。原 PNG 不受备注编辑影响。
- `apps/web/public/welcome-templates/manifest.json` 记录各图 SHA256 与尺寸；副本/备注是应用状态，不把不可编辑的 PNG 宣称成可编辑页面。
- 删除后台无会话时共用 guest ID 的兜底：每个访客仍可由 `/api/local/session` 获取隔离会话，但缺少或过期会话的私有接口返回 401；本地 trusted token 路径保留。
- Vite 和后端允许 Arena HTTPS 预览主机，并保留同源校验、Secure/Partitioned Cookie 及模板所有者隔离。

## 第三方登录的剩余部署条件

当前预览服务器的 Google / GitHub OAuth 均未配置。**真实第三方账号登录尚未端到端验收。** 不能把以下测试当作真实 Google / GitHub 授权成功。

1. 在对应服务商的开发者后台创建自己的 OAuth 应用。
2. 将 `.env.auth.example` 中的变量合并到被 Git 忽略的 `.env.local`，或通过部署平台的服务端密钥管理配置。不要把真实密钥发到聊天、提交 Git，或写入前端 VITE 变量。
3. `DESIGNBUDDY_PUBLIC_ORIGIN` 必须是实际 HTTPS 站点源；注册准确的回调：
   - `<源>/api/auth/oauth/google/callback`
   - `<源>/api/auth/oauth/github/callback`
4. 重启 `node scripts/dev-full.mjs`，检查 `/api/auth/providers` 对相应提供商返回 true，再在浏览器以真实账号完成授权、回跳和退出测试。
5. 静态 GitHub Pages 本身不能运行 OAuth/API；推送 GitHub 不等于已部署一个真实登录后端。正式使用还需要邮件验证/找回、限流与安全审计等额外工作。

## 已执行检查

- `corepack pnpm --filter designbuddy-web build`：通过 TypeScript 与生产构建。有现存的主 bundle 较大、fflate 静态/动态导入混用警告，不是零警告构建。
- `corepack pnpm exec tsc -p server/tsconfig.local.json`：通过。
- `node --test server/api/chat.test.cjs server/api/workspace-backend.test.cjs`：**13/13 通过**。
  - 包含 15 模板允许列表、读写、所有者隔离、CAS 冲突、非法第 16 编号、缺少会话拒绝、Arena HTTPS 源校验。
  - OAuth 测试只使用明确的假配置检查授权重定向、回调域名、缺失/重复 state；不发真实 token 交换请求。
- 浏览器 `welcome.spec.ts auth.spec.ts`：**23/23 通过**。
  - 包括四语切换及刷新保留、未配置/失败 OAuth 状态、模拟已配置时的端点跳转、真实密码注册/错误密码/正确密码与深链接、Cookie-less token 兼容、访客入口和断网欢迎页。
  - 1440/768/390/320 宽度检查、语言控件焦点、15 PNG 解码为 1440×1000、图片下载响应、备注副本及服务器保存/恢复。
  - 模拟的第三方配置只用于入口跳转测试，不是账号授权认证。
- 目视检查桌面与手机欢迎页；标题固定为“把灵感， / 带进现实。”，避免汉字跨意群断行。
- 15 张模板与 `designs/visitor-welcome/png` 原图逐字节哈希一致；完整 ZIP 的数量、CRC 检查通过。

### 额外旧回归测试的已知过期断言

额外运行 `home.spec.ts inspiration-categories.spec.ts` 共 14 项，8 通过、6 失败：
- home 的一个测试仍要求点击不存在的 `GLM-5.3-Flash`；实际目录只有 Agnes 默认项。这轮未修改模型目录或为过期测试新增假模型。
- 模板分类测试仍硬编码总计 22 套、HyperFrames/实时产物各 1 套；本轮前原目录已有 31 套、对应分类已有 5 套，本轮增加 15 后总计 46。5 项旧断言过期。未为迎合断言移除现有模板或新增欢迎模板。

因此只对上述明确范围声明通过，不宣称整个仓库测试全绿或生产安全认证。

## 重现

```bash
node scripts/dev-full.mjs
corepack pnpm --filter designbuddy-web build
corepack pnpm exec tsc -p server/tsconfig.local.json
node --test server/api/chat.test.cjs server/api/workspace-backend.test.cjs
# 安装 Playwright Chromium 后；此环境使用 /tmp/chromium 与额外 LD_LIBRARY_PATH
corepack pnpm --filter designbuddy-web exec playwright test welcome.spec.ts auth.spec.ts
```

图像源稿、15 PNG、原始 AI 素材及历史参考版本仍在 `designs/visitor-welcome/`，不是自动公开到第三方模板市场。字体 OFL 保留；AI 图片不保证独占权或商业法律验收。

## 最新表单优先设计已应用

在用户指出新图尚未替换后，已将 `designs/auth-login-concept/` 中的设计方向应用到 `/login`、`/auth`、`/register`：
- 品牌区下方提供真正的登录/注册导航，保留 `next` 深链接；输入框、主按钮在上，Google/GitHub 在下。
- 左卡片桌面宽 540px、最小高度 860px，手机取消固定最小高度；底部语言入口保持可操作。
- 输入框图标、真实的显示/隐藏密码按钮及其四语言无障碍名称；按钮不会提交表单。
- 欢迎页本身、山湖图片、后端登录接口、模板数据未改；OAuth 未配置状态继续明确显示。
- 本轮 23 项 auth/welcome 测试通过；新增布局和交互共 12 项最终重跑全部通过。最初联合运行中有一项测试切换英文后仍用中文查找字段，已修正为英文定位，不是修改页面来规避断言。
- TypeScript/生产构建通过，构建原有 bundle 大小提示仍存在。桌面登录页截图已人工目视对照设计。

## 未登录默认入口修复

用户反馈刷新首页仍显示旧界面，定位到 `App.tsx` 的访客及身份检查失败分支仍返回旧 `WelcomePage`，而此前只更新了显式 `/login` 页面。这不是通过清理缓存解决的问题。

现将这两个默认分支统一为新版 `LoginPage`，保留原始合法 `next`；确认账号仍直达工作台。显式 `/welcome` 作为欢迎与本地/访客入口继续保留，不再是未登录首页的默认返回。未改山湖画面、表单样式、后端或模板。

新增 `auth-entry.spec.ts` 验证未登录的 `/`、`/models`、`/inspiration/welcome-07` 在直接打开与刷新后均显示新版“表单在前、OAuth 在后”的结构，并验证已有账号刷新无需再次登录。更新原有测试，使默认入口断言与实际需求一致。

最终分批运行：`auth-entry.spec.ts auth-layout.spec.ts auth.spec.ts` 24/24 通过；`welcome.spec.ts` 15/15 通过，总计 39 项专项检查通过。最初联合运行触发工具等待超时，未将该次不完整结果记为通过，以上为分批完整结束的结果。生产构建通过，原有包大小告警未消除。
