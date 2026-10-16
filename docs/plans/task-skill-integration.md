# 首页与任务内文件技能接入

> 历史阶段记录。2026-10-16新增的PDF逐页OCR、双表关联及完整高级任务状态见[高级能力实施台账](advanced-experts-execution.md)；旧阶段测试数与能力缺口不代表当前状态。

日期：2026-10-15。属于[未完成任务台账](remaining-work-ledger.md)第2项的第一批，不代表全部12项欠缺已完成。

## 可使用的链路

1. 首页输入描述，打开输入框左侧“添加附件 → 添加文件”，选择“用实际文件执行技能”。
2. 进入同一任务的“文件技能与产物”，描述预填到方案表单。**创建任务不调用聊天/生成模型，不自动规划或执行。**
3. 选择真实材料。可授权规划模型建议一项已接通技能，也可使用不调用模型的手动工具。
4. 模型方案仍需单独核对并确认上传/执行，实际运行与产物保存在该任务分组内。
5. 切到“对话”可查看原聊天；普通任务也能随时切到“文件技能与产物”。普通发送按钮仍然是聊天/原生成流程，不偷偷改为执行。

首页旧聊天附件不会自动变成技能上传材料，不将附件正文、聊天全文或专家工作规范暗中发送给规划模型。规划目标使用任务的首条用户描述，可在表单编辑；不会自动截断长描述以冒充完整理解。文件仍由用户在执行区重新选择。

新任务会保存当时选定的专家ID；自建专家未绑定工具时明确阻止，不替换成其他专家。无固定专家时，规划可从注册表候选中选择一位；旧任务未保存结构化专家ID，不从聊天文本猜测其身份。规划沿用当前任务选择的模型，但供应商对模型标识的实际支持仍须真实联调验证。

## 后端分组及兼容性

- `SkillPlan`、`SkillPlanningRequest`、`SkillRun`增加可选`taskId`。
- `GET /api/skill-plans?taskId=...`和`GET /api/skill-runs?taskId=...`同时按当前服务端所有者和分组筛选。省略参数仍返回当前所有者的全部记录，兼容专家/技能全局页面。
- `taskId`是本地任务的分组标签，**不是项目成员权限或共享凭证**。知道其他人的任务ID不能读取对方记录；本轮没有借此开放项目共享。
- 手动执行可带`taskId`；模型方案确认只能继承已保存方案中的分组，不能在确认请求中重写。
- 分组进入方案摘要、规划/执行请求指纹和执行凭据。相同请求ID换分组返回409；不同任务不会绕过同一用户的次数限制。
- 无分组的旧方案摘要序列化保持字节兼容，旧方案、运行和去重记录无需删除或迁移。数据库仍是现有SQLite文件。

## 权限与恢复

- “仅本地”任务不挂载执行台，不请求技能清单/方案/运行API，也不允许上传或规划。切换到联网策略后仍需两阶段单独同意。
- 文件任务的权限选择仍是用户操作策略，不是一个新建的服务器项目ACL。实际每个操作继续校验服务端身份、所有者与确认信息；本轮没有声称实现完整组织/租户授权。
- 会话身份变化后关闭该任务的执行入口，清空文件与同意，用户核对账号后才重新打开。
- 切回仅本地、离开页面或切换模型不会假称停止已经提交的后台任务。页面有明确提醒，需要用户在运行区取消。
- 刷新后从后台读取同任务方案与运行，文件对象和同意不恢复，必须重新选材和确认。旧全局运行不会混入新任务。
- 任务对话正文及本机项目仍保存在浏览器。删除本机任务不会自动删除后台分组中的文件；全局技能执行台仍可管理当前账号的全部运行。

## 尚未完成

- 完整对话/附件云端保存、并发版本冲突及跨设备恢复。
- 授权后让模型读取真实产物并继续分析。现在同页显示执行结果，不把它伪装成聊天模型已读过产物。
- 多步骤技能调用、自动传递产物与恢复调度。
- 真实供应商选型准确率；当前缺少服务器模型凭据且受环境出站网络限制。

## 验证范围

新增5项服务端测试：任务分组/所有者过滤、审批不可改绑、真实worker凭据、请求ID跨组冲突、非法ID/仅本地拒绝、重启恢复、旧摘要兼容及预算不绕过（部分用例覆盖多条）。

新增8项浏览器测试：真实HTTP手动CSV处理与合计30、两任务不串记录、刷新恢复、模型/专家带入和附件正文不泄露、双阶段同意、仅本地不访问技能接口、普通聊天不回归、账号变化保护、自建专家不替换及320/390px布局。

模型选择用明确测试替身，但SQLite服务、后台worker及CSV结果没有伪造；另有无拦截的实际HTTP处理验证。测试数不等于36个专家真实业务案例验收。

## 最终回归结果

- 服务端 **61/61**，包含本轮新增5项任务分组/兼容性测试。
- 浏览器 **135/135**，包含本轮新增8项；覆盖任务/聊天/澄清、首页参考与附件菜单、原技能与专家回归，无跳过。不是135个新增用例。
- 目录/任务库 **9/9**；前后端TypeScript、生产构建、`git diff --check`通过。
- 依赖审计各级别均为0。构建仍提示既有大主包和fflate混合导入，未把它们标记为已经优化。
- 已查看390px任务内执行台截图；320/390px无页面横向溢出。
- 日志位于忽略目录`.cache/task-skills-final-{server,browser}.log`、`.cache/task-skills-build.log`、`.cache/task-skills-catalog.log`和`.cache/task-skills-audit.json`。

```sh
npx --yes pnpm@9.0.0 exec tsc -p server/tsconfig.local.json
node --test server/skills/service.test.cjs server/skills/phase-two.test.cjs server/skills/skill-planning.test.cjs server/api/expert-match.test.cjs server/api/chat.test.cjs
npx --yes pnpm@9.0.0 --filter designbuddy-web build
LD_LIBRARY_PATH="$PWD/.cache/browser/libs/lib" PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium npx --yes pnpm@9.0.0 --filter designbuddy-web exec playwright test task-skills.spec.ts skill-planning.spec.ts skill-phase-two.spec.ts skill-runtime.spec.ts expert-avatars.spec.ts experts.spec.ts skills.spec.ts expert-match.spec.ts conversation.spec.ts clarification.spec.ts attach-menu.spec.ts home-reference.spec.ts
```

仅本地实现，未推送。
