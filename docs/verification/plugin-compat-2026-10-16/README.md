# 验收证据包：插件包兼容版本检查与权限声明校验（P08 可独立完成部分）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
- 验收日期：2026-10-16（第七轮）
- 证据包目录：`docs/verification/plugin-compat-2026-10-16/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**26 项全部通过**（desktop 1440×900 与 mobile 390×844 各 13 项，0 失败 / 0 未验证）
- 专项用例：`apps/web/tests/plugin-lifecycle.spec.ts`（Playwright，新增 1 项：接口版本、真实权限与解析到的技能版本）
- 服务端用例：`server/api/plugin-registry.test.cjs`（node:test，8 项，其中 3 项为新增）

## 这次验收证明什么

1. **插件接口版本会被检查**：每个插件包声明它需要的插件接口版本；服务端只支持 `1.x`，
   声明 `2.0` 的包会被拒绝安装，并说明"要求插件接口 2.0，当前服务端只支持 1.0"（服务端用例断言）。
2. **权限声明必须与真实技能一致**：插件包声明的权限要和它捆绑技能真正会用到的权限**完全一致**——
   少声明（"没有声明它需要的权限"）或多声明（"声明了它的技能并不会使用的权限"）都会被拒绝安装。
   面板上显示的是人话标签（"读取本机上传文件""访问网络地址""启动本机子进程"），不是内部标识。
3. **安装时解析技能版本**：安装记录写入 `技能@版本`（如 `document.format@1.0.0`），面板上可读，
   生命周期日志里也能查到，作为"当时到底跑了哪个版本"的凭证。
4. **不兼容的包不给安装按钮**：面板显示兼容结论与原因；不兼容时"安装"按钮禁用。
5. **既有生命周期没被破坏**：安装 / 停用 / 启用 / 卸载仍然是服务端真实状态变更并写日志。

## 明确不成立的结论

- 这**不是**第三方插件包的分发市场：插件包仍然只来自服务端登记的 `server/plugins/bundles.json`，
  外部作者不能上传包，也没有签名校验、审核与版本升级通道。
- "兼容"目前只检查**插件接口主版本**与**权限声明**，不检查技能版本区间（例如某技能从 1.0 升到 2.0
  会不会破坏插件），也没有自动回滚与灰度。
- 插件依然**不执行第三方代码**：它只组合已登记技能，实际执行仍受技能自身的权限与授权约束；
  插件不会因为被安装就获得任何额外权限。
- 证据包只证明"声明的检查项在声明的视口下实际执行过"，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
node node_modules/typescript/bin/tsc -p server/tsconfig.local.json && node --test server/api/plugin-registry.test.cjs
node apps/web/scripts/run-playwright.mjs test tests/plugin-lifecycle.spec.ts
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-plugin-compat.suite.json \
  --out docs/verification/plugin-compat-2026-10-16
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
