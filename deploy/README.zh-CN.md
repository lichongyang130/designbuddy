# DesignBuddy 服务器部署包

适用域名：https://designbuddy.56juqingba.com

这是 Web 前端 + Node.js API 后台 + SQLite 持久化 + Caddy HTTPS 的源码构建包，
不是仅上传静态网页，也不是 Windows/桌面安装程序。服务器构建时需要联网下载镜像和依赖。

## 1. 服务器准备

- 建议 Linux Ubuntu 24.04 / Debian 12，Docker Engine + Docker Compose v2（`docker compose version`）。
- 建议至少 2 核、4 GB 内存、20 GB 可用磁盘，构建内存不足时增加内存或 swap；这是部署建议，不是压测容量保证。
- 首选 x86_64；其他架构未验证，尤其离线英语语音识别有 x86_64 限制。
- 将域名 A 记录指向服务器公网 IPv4；如果配置了 AAAA，IPv6 也必须实际可达。
- 安全组/防火墙放行 TCP 80、443；可选 UDP 443。只向管理员开放 SSH，不开放 8787。
- 本方案由 Caddy 占用 80/443。如果已有宝塔/Nginx/其他网站占用，先不要启动或停止现有服务；请让维护者采用后面的“已有反向代理”方案。
- 服务器需要访问 Docker Hub、Debian 软件源、npm；登录后台还需访问 Google/GitHub OAuth API。中国大陆服务器的 Google 出站连通性必须先确认。

## 2. 上传并解压

将 `designbuddy-server.tar.gz` 上传到服务器，例如 `/opt`，然后执行：

```sh
cd /opt
sha256sum designbuddy-server.tar.gz
# 与随包提供的 designbuddy-server.tar.gz.sha256 中的校验值比较
# 然后解压：
tar -xzf designbuddy-server.tar.gz
cd designbuddy-server
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
nano deploy/.env
```

填入新的 Google Client ID/Client Secret；旧的聊天中泄露密钥必须先撤销。
没有配置 GitHub 时保持那两个变量为空。不要将真实凭据放入 Dockerfile/Caddyfile/浏览器代码。
不要执行会把完整配置和密钥打印出来的 `docker compose config` 后复制到聊天中。

Google 控制台：
- 来源（如需填写）：`https://designbuddy.56juqingba.com`
- 回调：`https://designbuddy.56juqingba.com/api/auth/oauth/google/callback`
- 授权网域（如要求填写）：`56juqingba.com`
- 测试状态需添加测试邮箱。

GitHub OAuth App：
- Homepage：`https://designbuddy.56juqingba.com`
- Callback：`https://designbuddy.56juqingba.com/api/auth/oauth/github/callback`

## 3. 构建并启动

以下命令在解压后的 `designbuddy-server` 目录执行：

```sh
docker compose -f deploy/compose.yaml up -d --build
docker compose -f deploy/compose.yaml ps
docker compose -f deploy/compose.yaml logs --tail=80 app caddy
```

首次构建下载依赖、字体和 LibreOffice，可能比较慢。Caddy 自动申请和续期证书，
前提是 DNS 正确且公网能连入 80/443。不要同时启动仓库的开发服务器，不需要开放 5173。
应用由一个 Node 进程同时提供生产前端和 `/api/`，反向代理保留原 Host，不使用 Vite 开发服务器。
不要把服务扩成多个副本：当前 OAuth state 位于单进程内存，有效期 10 分钟；授权途中不要重启。

## 4. 验收（必须在你的服务器完成）

```sh
curl -fsS https://designbuddy.56juqingba.com/api/health
curl -fsS https://designbuddy.56juqingba.com/api/auth/providers
```

第二个接口返回两布尔值，true 只表示已读取非空变量，并不证明凭据正确。
在独立浏览器标签页打开网站：
1. 首页/刷新/深链进入新版登录界面，右侧山湖主视觉及 15 个模板可访问。
2. 测试密码注册、登录、退出。
3. 测试 Google/GitHub 授权、返回工作台、刷新、退出再登录，以及拒绝授权。
4. 重建/重启 app 后账号和项目仍存在。

首次第三方登录会创建账号；相同邮箱的 Google/GitHub 不自动合并。
AI 对话/生图仍需另行选择与配置供应商，不因 OAuth 配置而自动具备。

## 5. 数据、更新、备份

数据保存在 Docker 命名卷：`designbuddy_app_data`、`designbuddy_app_cache`；
证书保存在 `designbuddy_caddy_data`、`designbuddy_caddy_config`。
数据和缓存都要保留，因为部分项目/产物持久化路径可能位于缓存目录。
`restart`/`up --build` 不删除卷；**禁止随意使用 `docker compose down -v` 或清理卷**。

更新前在当前版本目录备份：

```sh
bash deploy/backup.sh
```

脚本短暂停止 app，备份 data/.cache 后恢复 app。备份放在 `backups/`，包含用户数据，需安全离机保存。
`deploy/.env` 单独安全备份，不放进公开附件或 Git。恢复备份前先停止 app 并先备份现有卷；
可通过 `docker compose run --rm --no-deps -T --user root --entrypoint tar app -xzf - -C /app < 备份文件`
恢复到相同卷，再启动 app（该命令需在 deploy 目录执行）。旧文件不会自动删除，迁移应优先恢复到空卷。

替换源码时不要覆盖 `deploy/.env`，保留相同 compose 项目名和卷名，执行 `up -d --build`。
只改密钥则执行：

```sh
docker compose -f deploy/compose.yaml up -d --force-recreate app
```

不需要重新构建前端。注意：单纯 `restart` 不会重新加载 compose env_file。

## 6. 已有宝塔/Nginx/HTTPS 反向代理

不要启动本包 Caddy。新建 `deploy/compose.existing-proxy.yaml`：

```yaml
services:
  app:
    ports:
      - "127.0.0.1:8787:8787"
```

仅启动 app：

```sh
docker compose -f deploy/compose.yaml -f deploy/compose.existing-proxy.yaml up -d --build app
```

在已有站点的 HTTPS server 配置中将整个站点代理到 app，不只是 `/api/`：

```nginx
location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_read_timeout 300s;
    client_max_body_size 101m;
}
```

TLS 证书由已有站点管理；确认域名、证书和全站 HTTPS，再测试 OAuth。
不要使用此 HTTP 端口直接公开登录，也不要直接信任客户端提供的转发 Host。

## 7. 功能与验证边界

- 包含生产前端源码、后端源码、内置欢迎模板/样例、字体、锁文件和部署配置。
- 不包含真实 OAuth/AI 密钥、开发数据库、用户上传内容、node_modules、.git 或桌面 Electron。
- 包含 FFmpeg、Python、中文字体、Poppler、LibreOffice 的安装配置，但不代表所有文档/技能已在正式服务器验收。
- OCR 模型由已锁定 npm 依赖提供，首次使用写入数据卷；离线英语 ASR 模型未打包，需在容器中按 `scripts/setup-asr.py` 单独安装/自测。
- 浏览器验收技能依赖额外 Chromium/系统库及明确的目标白名单，不在默认启动中自动安装或开放任意外站。
- 本部署包未在本环境执行 Docker 构建/签发证书（本环境没有 Docker），本地生产构建与 HTTP 冒烟结果见随包 `deploy/VERIFICATION.md`。
- 这不是完整生产安全审计或高可用方案。正式开放前需完成服务器补丁、备份恢复演练、第三方真实登录与业务验收。
