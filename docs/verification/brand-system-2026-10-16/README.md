# 品牌系统实跑证据 · 2026-10-16

- `assets/`：原始品牌简报与技能实际生成的8份成果（SVG×2、PNG×2、品牌系统JSON、CSS变量、品牌规范HTML、字体许可），另加服务自动生成的`execution-receipt.json`。
- 经真实服务队列/worker生成；SQLite使用隔离`:memory:`实例，不访问应用数据库。真实下载全部9项，逐一重算与服务所报SHA-256一致；外部所有者下载全部404，响应`private, no-store`。
- `screenshots/`：从实际下载的HTML在Chromium中打开后捕获桌面和390px手机响应式截图；已目检，简体中文字体正确显示，色板由三列转为单列。HTML仅嵌入此规范实际使用的本地WOFF2子集，无外部字体请求。首次截图发现无系统中文字体时的方框缺字已修复。
- `logs/brand-targeted.log`：10/10品牌专项（含真实服务队列）。`logs/brand-browser.log`：真实浏览器上传/执行/九文件校验与下载、离线字体检查、双视口截图1/1。`logs/catalog.log`：9/9目录测试。
- `logs/server-no-asr.log`：136/136服务端/API测试通过，明确排除可选PocketSphinx测试文件；无跳过。`logs/full-server-without-asr-model.log`另保存曾执行的全量命令结果：145项中137通过、8失败、0跳过；8项失败是ASR真实模型测试所需的忽略目录不存在，不计入通过。
- `logs/build.log`：前后端TypeScript及生产构建通过；约2.5MB JS主包及fflate混合导入警告仍存在。
- `assets/verification-report.json`记录源简报SHA-256、各产物SHA-256和权限核验；`logs/worker-run.log`为最终服务真实运行回执日志。

复验：`corepack pnpm exec tsc -p server/tsconfig.local.json && node --test server/skills/brand-system.test.cjs && node scripts/verify-brand-system.cjs`。浏览器专项需安装Playwright Chromium；本次使用的临时二进制没有纳入仓库。

本证据不证明商标权利、创意独特性、完整品牌实践、全站通过、36个真实业务案例或生产部署。未推送/部署/更新云端备份。
