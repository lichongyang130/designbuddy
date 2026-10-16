# 多文件多表关联实际执行证据 · 2026-10-16

- `artifacts/input-example.zip`：随应用提供的原创三CSV+`joins.json`输入示例，798字节；对应源SHA-256在验证报告。
- `artifacts/multi-joined.xlsx`与`multi-join-report.json`：通过真实`SkillService`队列/Worker生成并从后端下载，内容哈希与服务记录一致；工作簿含关联结果及各源CSV行号。
- `artifacts/execution-receipt.json`：后台服务附加的本次运行回执。所有三份产物的跨用户下载均返回404；使用隔离`:memory:`数据库，不触碰应用数据库。
- `logs/backend-no-asr.log`：排除可选ASR真实模型测试文件后，服务端/API 147/147通过、无跳过。
- `logs/browser.log`：真实Playwright页面上传、同意执行、后台任务完成、XLSX下载并验证来源行号，1/1通过。
- `logs/catalog.log`：专家目录/提示词9/9；`logs/build.log`前后端TypeScript和生产构建通过。主包体积及fflate混合导入提示仍存在。
- `artifacts/verification-report.json`与`results.json`包含输入、输出工件字节数、SHA-256、队列与权限结果。不是业务语义/真实商业口径验收，也不是全站浏览器回归。

复验：`corepack pnpm exec tsc -p server/tsconfig.local.json && node --test server/skills/table-join-multi.test.cjs && node scripts/verify-multi-table-join.cjs`。
