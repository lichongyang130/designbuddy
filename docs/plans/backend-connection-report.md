# 后台接入说明与验收

更新：2026-10-15。范围是当前 DesignBuddy 预览的**基础服务接入**，不是全部业务后台完成。

> 后续模板扩展已新增并验收 ATELIER、ROOTS、DAYLIGHT、TIDE、MORROW，当前目录与服务器快照支持 **19 套**。下文 14 套及 140 项为后台接入当时的历史验收范围；最新扩展进度与 157 项社区/后台回归见 `community-180-progress.md`。

## 已实际接通

| 范围 | 实现及入口 | 边界 |
|---|---|---|
| 同源 API | Vite `/api` → Node 服务；`/api/health` 返回真实 JSON | 静态 GitHub Pages 不会运行这些服务 |
| 身份与账号 | 独立访客、用户名/密码注册、登录、退出；左下角「工作区状态」，手机可从「设置 → 个人主页 → 后台连接与账号」进入 | 基础预览账号，不是生产身份平台；无邮箱验证、密码找回、账号删除管理或完整安全审计 |
| 项目 | 复用现有项目仓库，SQLite 持久保存；编辑器「同步云端」及项目页「载入云端/团队项目」真实调用 API | 本机编辑仍默认只存浏览器；云端项目不包含完整任务对话、附件和首页场景状态；不同版本覆盖本地草稿前确认 |
| 14 套社区作品 | 每套及其副本的「保存到服务器」「恢复服务器版本」「检查服务器版本」；社区「服务器作品」目录 | 明确点击才上传；每个作品/副本只保存最新快照，未上传本地命名版本历史；没有服务器快照删除/回收站管理 |
| 跨设备恢复 | 同一账号在另一个浏览器登录后，从服务器作品目录恢复并打开作品或副本 | 不会自动合并、覆盖本地草稿；匿名访客丢失 cookie 后不能找回，因此应先注册 |
| 视频 MP4 | 已安装 FFmpeg 并实测 Studio 的 5 秒动画 → WebM 上传 → H.264 MP4 下载 | 本接口输出无声视频；不等于 LAKESIDE 字幕烧录、专业剪辑或完整视频渲染任务系统 |
| 真实失败 | API HTML 回退、断线、鉴权、版本冲突显示错误；MP4 接口必须返回 MP4 类型及文件头，否则保留 WebM | 不以 HTTP 200、按钮点击或保存参数伪装服务成功 |

### 使用方式

1. 打开「工作区状态」，确认 SQLite 已连接，再注册服务器账号。注册保留当前访客已上传的项目和模板；登录已有账号不合并访客数据。
2. 在任意社区模板实际编辑，点击「保存到服务器」。已有服务器版本时，会要求确认覆盖。
3. 在另一个浏览器登录相同账号，打开社区的「服务器作品」，确认恢复并打开。
4. 多标签页若版本冲突，先下载本地备份或制作副本，再选择服务器版本；不会静默覆盖较新的快照。
5. 退出只退出服务器账号，**不删除本机草稿**。共享设备还需自行处理浏览器站点数据；不要误以为退出就清空本地资料。

## 启动和配置

要求 Node **22.13+**、pnpm 9；使用浏览器验收还需要 Chromium 及系统库/中文字体。

```sh
pnpm install --frozen-lockfile
pnpm dev:full
```

完整启动器先编译后台，再同时启动 API `0.0.0.0:8787` 和 Web `0.0.0.0:5173`；退出会关闭两个子进程。打开 **5173** 的预览。浏览器调用相对 `/api`，不会请求用户电脑的 localhost。

- 启动器读取仓库根 `.env`、`.env.local`，已存在的进程环境优先；两文件不要提交。
- 默认 SQLite 为 `data/designbuddy.sqlite`，不进 Git。服务重启会保留，但删除工作区/数据库、新建远端克隆不会自动迁移数据。
- 备份数据库时先停止服务再复制数据库文件；在线备份应使用 SQLite backup API，不能只复制活跃 WAL 模式的主文件。
- `DESIGNBUDDY_PORT`、`DESIGNBUDDY_WEB_PORT` 可调整端口；`DESIGNBUDDY_API_TARGET` 为 Vite 的服务端代理目标，不是浏览器地址。
- HTTPS 自有域名可指定 `DESIGNBUDDY_PUBLIC_ORIGIN=https://app.example.com`；反向代理必须保留 Host。不要把不受信任的 `X-Forwarded-*` 当作身份或协议依据。
- 单独启动后台：先构建 Web，再 `pnpm local:daemon`。该命令只读取进程环境；可用 Node 的 `--env-file` 参数显式加载本地配置。不要只运行 Vite 就认为后台也已运行。

### 可选 FFmpeg 安装

系统已有 FFmpeg 时使用 PATH 或 `FFMPEG_PATH`。当前预览采用以下可复现方式安装；二进制在忽略缓存，不进入 Git：

```sh
# 需要 Python 3/pip，通过 PyPI 安装 imageio-ffmpeg 0.6.0 的平台二进制
pnpm setup:ffmpeg
# 重启完整服务，自动读取 .cache/ffmpeg-path.txt；显式 FFMPEG_PATH 优先
pnpm dev:full
```

缓存被清除后需重新安装；遵循 imageio-ffmpeg 与其所附 FFmpeg 二进制各自的许可，二进制没有打包进本仓库。`/api/health` 会执行一次带超时的版本探测，不仅检查配置字符串。转码检查 EBML 文件头并固定 Matroska/WebM 解复用器，限制文件协议、2 个并发任务、每次 2 个编码线程及 90 秒超时；生产仍应部署隔离 worker、配额、内存/CPU 限制和任务队列。

## 数据与安全

- Cookie 为 HttpOnly；HTTPS 使用 Secure / SameSite=None / Partitioned，适配预览嵌入；HTTP 开发使用 SameSite=Lax。服务器仅保存会话 token 的 SHA-256，30 天到期。
- 密码使用独立随机盐和 scrypt；不是明文或简单 SHA 密码。注册/登录有基础进程内频率限制，仍需生产级身份和滥用防护。
- 项目按服务端身份隔离；模板主键为 `(owner, sample, draft)`；不能提交一个 owner 参数来读写他人数据。
- 修改请求校验 Origin、Host 与协议。浏览器 cookie **不能执行本机 CLI**。本机工具需要显式 Bearer token，CLI 还必须设置 `DESIGNBUDDY_ENABLE_LOCAL_AGENT=true`；不要将这种 token 放在前端。
- 模板快照采用事务内 revision compare-and-swap；旧 revision 返回 409。每账号最多 200 份，每份状态 500 KB。恢复仍经过每种编辑器的状态校验。
- 项目成员/协作路由复用既有模块；本轮验证不代表已做完多主机协作、冲突合并或生产部署审计。
- 目前没有账号回收、数据删除管理、自动备份、完整审计、对象存储和生产租户管理。请勿存放敏感或不可替代的唯一数据。

## 验收

```sh
pnpm test:backend
pnpm --filter designbuddy-web test:backend
pnpm --filter designbuddy-web test:inspiration
pnpm --filter designbuddy-web exec playwright test account.spec.ts settings.spec.ts workspace.spec.ts conversation.spec.ts sidebar.spec.ts
pnpm --filter designbuddy-web build
```

- Node 验收 **8/8**：6 项聊天 provider/mocks 测试，1 项实际子进程 HTTP 集成测试，1 项自有 HTTPS origin 校验；HTTP 集成覆盖注册、会话轮换、登录/退出、权限隔离、项目 CRUD、模板 revision 冲突、输入限制、CSRF、危险 CLI 拦截、重启持久化，以及未配置能力的明确错误。
- 新浏览器验收 **12/12 全部通过（无跳过）**：真实跨浏览器账号/项目/模板恢复、14 编辑器保存、媒体副本恢复、标签页冲突、过期会话恢复、离线/HTML 假响应、4 种宽度以及真实 FFmpeg MP4。FFmpeg 未安装的其他机器会明确跳过编码项，不会把跳过算作编码成功。
- 合并回归 **140/140 全部通过（11.2 分钟，无跳过）**：包括上述 12 项、社区/FORME 76 项、以及账号设置、模型设置、任务对话、共享侧栏和 15 场景工作区相关回归。12 和 76 是 140 的子集，不重复相加。
- 最后补充 FFmpeg 连接状态展示与设置说明后，账号/设置/后台 **29/29 再次通过**，仍为上述 140 项的子集。
- Web 生产构建和后台 TypeScript 编译通过，`git diff --check` 无错误。构建仍有既有 fflate 混合导入及大分包警告。
- 外部 AI 的测试使用 mock provider；没有调用真实付费模型。OAuth、支付和商家业务没有通过本轮测试变成已接通。

## 仍未接通

1. **AI 模型服务**：路由已挂载，但当前没有配置并验证真实模型凭据与可达网络；任务历史云端、附件解析、专家/技能执行仍待做。
2. **第三方连接器**：当前明确返回 `503 NOT_CONFIGURED`。需要各服务实际 OAuth/工具后端和授权；Arena 的连接器不是此应用已经部署的连接器。
3. **FORME 等真实业务**：商品/SKU 管理、服务端报价、库存扣减、商家订单、支付/退款、物流、售后和预约尚未完成。把演示订单状态保存到 SQLite **仍是作品快照，不是真实订单**。
4. **平台执行闭环**：定时任务、通知、插件安装/沙箱、发布、文件存储、完整协作和账号资料管理仍按缺口清单推进。
5. **180 套扩展**：继续暂停，仍是新增 1/180、社区 14 套；没有将后台工作算成新增模板。

当前会话仅本地实施，未推送或合并 GitHub。当前会话的远程操作已结束，后续远端交付需新编码会话并先确保本地成果已迁移。
