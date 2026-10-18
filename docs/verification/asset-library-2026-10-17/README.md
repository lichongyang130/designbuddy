# 验收证据包：服务端素材库与附件云端解析（P05 / P02 可独立完成部分）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
- 验收日期：2026-10-17（第十一轮）
- 证据包目录：`docs/verification/asset-library-2026-10-17/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**14 项全部通过**（desktop 1440×900 与 mobile 390×844 各 7 项，0 失败 / 0 未验证）
- 专项用例：`apps/web/tests/asset-library.spec.ts`（Playwright，新增 1 项：上传 → 服务端解析 → 改可见范围 → 看操作记录 → 删除）
- 服务端用例：`server/api/assets.test.cjs`（node:test，5 项，全部为新增）

## 这次验收证明什么

1. **文件真的存在服务器上**：上传的字节由服务端落盘（`data/assets/`），并记录 SHA-256 指纹、大小、
   MIME 与上传时间；浏览器不再把文件内容塞进对话文本里。
2. **文本由服务端解析**：txt / md / csv / json 等文本类文件由服务端解析出正文（上限 200 KB）；
   二进制文件**只保存不解析**，接口会明确返回 415「这个文件不是文本，服务端没有解析它」，
   页面显示「未解析（二进制文件）」——不会假装读过它。
3. **可见范围由服务端裁定**：`private`（仅自己）/ `workspace`（同工作空间成员）/ `public`（已登录账号）。
   非成员既看不到也读不到（403），非所有者不能改范围、不能删除（403）。
4. **删除是真删除**：删除后文件与磁盘副本一起消失（404），但**操作记录仍然保留**给所有者
   （`asset.upload` / `asset.visibility` / `asset.delete`）。
5. **配额是真的**：单文件 5 MB、每账号 50 个文件、总容量 100 MB，超限返回 413 而不是默默截断。
6. **首页附件走同一条真实链路**：首页与任务对话页选择文件后，文件先上传到服务器素材库，
   文本由服务器解析后再带入需求；服务器不可用时才回退到浏览器本地读取（并如实说明）。

## 明确不成立的结论

- 这**不是**文档中台：服务端只解析纯文本，PDF / Office / 图片**不做解析**，
  也不会假装已经读过这些文件；OCR 与 DOCX 解析仍是技能执行器里的独立能力。
- 素材库**没有版本管理**：同名文件重复上传会生成新的素材条目，不会自动去重或覆盖。
- 没有病毒扫描、没有预览渲染（图片只能看到文件名与大小）、没有批量操作与检索。
- 「工作空间可见」依赖成员关系真实存在；没有工作空间时该选项与「仅自己可见」效果相同。
- 附件云端解析只覆盖首页与任务对话页；技能执行台仍然按自己的方式读取本机文件。
- 证据包只证明"声明的检查项在声明的视口下实际执行过"，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
node node_modules/typescript/bin/tsc -p server/tsconfig.local.json
node --test server/api/assets.test.cjs
node apps/web/scripts/run-playwright.mjs test tests/asset-library.spec.ts
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-assets.suite.json \
  --out docs/verification/asset-library-2026-10-17
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
