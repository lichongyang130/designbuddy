# 部署包验证记录（2026-10-19）

目标域名：`https://designbuddy.56juqingba.com`。

已执行：
- 后端 TypeScript 编译通过。
- 前端生产构建通过（`GITHUB_ACTIONS=false`，根路径 `/`）。
- `server/api/workspace-backend.test.cjs`：6/6 通过。
- Compose YAML 可解析；API 不暴露宿主端口、配置文件/数据卷路径静态断言通过。
- 备份脚本 `bash -n` 通过。
- 初版包解压后 `MANIFEST.sha256` 全文件校验通过。
- 解压包中按 Docker 相同工作区过滤规则、使用冻结锁文件离线安装依赖通过（382 包；跳过安装脚本，仅验证依赖完备性）。
- 解压包后端编译及前端生产构建均通过，不依赖仓库外的源码文件。
- 从解压包启动生产 daemon，通过真实 HTTP 验证：HTML/JS、内部深链、15 张欢迎 PNG、公开登录选项、私有接口 401、HTTPS 域名的同源/跨站校验、Secure Cookie、注册及重启后登录态持久化。
  命令：在已构建的解压包根目录执行 `node scripts/test-server-package.mjs`；该脚本使用独立临时数据目录并自行关闭进程，不调用真实 OAuth。

尚未执行：Docker 镜像构建、Docker Compose 实际启动、服务器 DNS/HTTPS 签发、真实 Google/GitHub 授权、备份恢复演练。
原因：当前环境没有 Docker，也没有正式服务器访问权限；不使用已在聊天中披露的密钥。

健康接口和 provider 布尔值不是所有技能或第三方调用可用性的证明。
