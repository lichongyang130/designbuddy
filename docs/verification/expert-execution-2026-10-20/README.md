# 专家真实执行与产物修订验证

日期：2026-10-20。实现方案：[专家与技能执行方案](../../plans/expert-skill-execution-2026-10-20.md)。能力配置版本：`2026.10.20-1`。

## 可以使用的变化

- **咨询和制作分开**：普通咨询仍走对话；明确文件交付进入任务内的「专家制作与交付」。首页选择真实技能时传递技能 ID，不再只把名称塞进提示词。现有网页 AI 生成入口保留，不偷偷替换为另一种制作引擎。
- **专家有主责和可执行范围**：服务端登记专业方法、检查要求、成果范围、实际执行器与版本。主责和每个执行角色分别显示；手动锁定不兼容专家时阻断，不静默换人。
- **计划不算执行**：规划不上传正文、不调用付费模型、不产生文件。只有核对实际输入并确认后才提交原有 SkillService / WorkflowEngine；任务页展示真实运行 ID、输入哈希、文件、检查及失败原因。移除了把推荐/选择标成已完成工序的显示。
- **8 类成果接通已有执行器**：PPT、文档、表格、品牌、营销视觉、网页、项目规格、静态质量检查，复用原有 49 个底层工具和 11 个配方。目录存在不等于所有依赖或配置就绪。
- **Word 内容准备与排版分开确认**：可按实际 TXT/MD 正文让已配置的服务端模型准备结构化草稿；草稿可审阅编辑，另行授权才排版。人工结构稿仍可在不调用模型的情况下生成真实 DOCX、同源 PDF 和检查报告。结构引用校验不等于语义/事实核验。
- **真实续改**：经账户校验读取原运行的原始字节、验证 SHA-256，撤销旧执行同意。Word 可编辑实际结构化 JSON 后生成 V2；PPT 恢复原来源文件、图片与需求，在新任务要求下重新准备，每张图片版权声明和两层执行授权重新确认；配方复用实际字段/行/素材，重新确认后保存新运行。旧版本不覆盖。
- **自建专家真实绑定**：可绑定已登记的能力模板，服务器限制其成果范围和权限；不绑定时明确仅指导。绑定按服务端账户保存，名称和职责不是工具安装、模型配置或官方资质。

## 安全、费用与持久化

- 新增 owner-scoped SQLite 编排记录：默认 `data/expert-execution.sqlite`，可通过 `DESIGNBUDDY_EXPERT_DB` 指定；不要将运行数据库、账户资料或上传材料提交 Git。
- 计划 24 小时有效；配置版本变化后需重新规划。确认摘要、任务 ID、路线、原始字节和参数绑定到本次提交；请求幂等，付费调用不自动重试。
- 每账户最多 25 个自建绑定、1000 份计划、1000 份执行版本记录。底层技能现有数量、文件、运行时间和存储限制继续生效。
- Word 自动内容准备每账户滚动 24 小时最多 20 次，同时最多 1 次、该服务实例全局最多 2 次；每次最多一次模型请求。最多存 100 份草稿，可删除本计划的后台草稿。
- 模型尝试计数独立保存；删草稿不重置配额，已删请求 ID 不能再次触发模型。删草稿不删除已有产物、供应商记录或调用计数。
- `GET /api/skill-runs/:id/input` 仅返回当前所有者的原始输入，`no-store` / `nosniff`；其他账户 404、未登录 401；删除运行后原输入不可再读。
- 「仅本地」不创建后台制作计划、不上传材料、不调用模型；账户变化关闭执行入口并撤销授权。跨站写请求仍由现有同源防护拒绝。

## 本轮验证记录

- 服务端 TypeScript 编译通过。
- Web TypeScript / Vite 生产构建通过，726 modules；仍有既有大 bundle / 动静态导入分包警告，不称为零警告。
- 最终串行后端回归 **138/138 通过**，0 failed / skipped，172879ms，其中专家执行专用 18 项全部通过。
- 最终浏览器完整回归 **94/94 通过**，8.0 分钟；包含 12 项专家交付、2 项 PPT 原输入修订/跨轮主责锁定，以及原有专家匹配、专家目录、对话、任务技能、PPT 准备、Word 和成果目录回归。
- `git diff --check` 通过。

日志保存时仅去除终端颜色控制符和行尾空白，未改变测试结果。

完整验收日志：[后端 138 项](logs/node.log)、[浏览器 94 项](logs/browser.log)、[Web 生产构建](logs/web-build.log)。

早轮验证发现并修复：自建绑定保存后详情状态未刷新、重复权限控件、旧网页生成路线被新制作入口抢占、PPT 高级入口测试仍访问旧目录，以及必填字段标签的定位问题。曾在并发原生 Office 渲染和浏览器测试时出现转换/登录等待超时；最终验收改为先后端、后浏览器串行执行，没有放宽生产超时或伪造成功。原生渲染在隔离执行下恢复通过。

### 真实执行覆盖与测试替身边界

| 类别 | 本轮验证范围 | 不代表什么 |
| --- | --- | --- |
| Word | 真实结构稿 → 原生 DOCX → 同源 PDF/报告；浏览器刷新恢复；读取原输入并改标题生成 V2，解压新 DOCX 检查实际 XML，比较父版本和不同输入哈希 | 不代表模型事实正确、Word/WPS 全版本兼容或商业批准 |
| 营销视觉 | 合成且明确标注的实际 PNG 上传 → 方/竖海报 PNG/SVG → WebP；刷新恢复；复用真实输入改标题后新运行 | 不是自动生图、真实客户项目或许可法律审定 |
| 数据/品牌/网页/项目/质量 | 专家计划经现有真实执行器产生文件、独立静态检查或报告；验证运行关联与账户隔离 | 静态检查不是代码构建、运行时测试或无障碍认证 |
| PPT | 缺 AI 配置真实阻断；现有规划/编译/渲染集成回归；需求、素材、权限及修订恢复的浏览器测试使用明确标注的受控替身 | 没有新采购/配置模型，没有本轮真实付费模型 PPT 商业案例验收 |
| Word 模型写稿 | 使用受控模型响应验证一次调用、缓存、结构约束、失败、配额、删除防绕过和独立授权 | 不把受控响应当真实供应商调用、费用或内容质量评测 |

截图仅证明当时 UI 和实际运行记录，不作为视觉或商业验收：

- [Word 任务与实际交付入口](word-real-delivery.png)
- [营销配方真实产物列表](marketing-real-delivery.png)
- [390px 任务计划](mobile-plan.png)

## 明确未完成的商业与通用能力

1. 本轮完成统一执行主链和上述版本适配，不宣称整个三阶段方案的所有商业验收已经完成。
2. 没有新增真实付费模型/自动配图供应商调用；PPT 与 Word 模型效果需要用户既有服务配置和真实授权材料分别验收。
3. Word/PPT 续改不是任意旧 Office 文件、任意原生对象的无损编辑器。PPT 是从原材料和新要求重新生成；结构稿编辑和渲染成功不等于所有目标客户端表现一致。
4. 自动硬检查、模型建议、人工审核分别对待；不伪造独立审查专家、多模型协作、事实认证或「优于商业版」结论。复用已有配方的独立检查与有限修复，不新增无限自主代理循环。
5. 文件任务的底部追问默认更新制作要求，并提示重新核对真实输入；不是一句话自动无损改稿。Word 结构稿需要实际编辑；任意旧对象级自然语言修改不在本轮承诺内。
6. 仍须用真实业务样本分别核对事实、遗漏、逐页观感、编辑性、字体、Word/WPS/PowerPoint、费用和授权。`commercialAcceptance` 保持待人工复核。
7. 未正式部署、未配置用户密钥、未采购或发布社区内容；原有 ID、历史、登录和右侧视觉不迁移重做。`code.build` 等不可用能力仍如实阻断。

## 预览检查

最终代码已刷新本工作区 5173 / 8787 预览：页面 HTTP 200、公共技能目录 HTTP 200、未登录私有专家 API HTTP 401。此检查不代表正式域名已部署。

## 复现

```sh
node node_modules/typescript/bin/tsc -p server/tsconfig.local.json
corepack pnpm --dir apps/web build

node --test --test-concurrency=1 \
  server/api/expert-execution.test.cjs server/api/chat.test.cjs \
  server/api/expert-match.test.cjs server/api/workflows.test.cjs \
  server/api/skill-products.test.cjs server/api/assets.test.cjs \
  server/skills/service.test.cjs server/skills/skill-permissions.test.cjs \
  server/skills/skill-planning.test.cjs server/skills/word-pro.test.cjs \
  server/skills/presentation.test.cjs server/skills/presentation-integration.test.cjs

# 原生 Office 渲染较重，在受限容器内不要同时跑两组完整原生渲染测试。
# 可先单独启动测试服务，再执行浏览器回归：
DESIGNBUDDY_WEB_PORT=5174 DESIGNBUDDY_PORT=8788 node scripts/dev-full.mjs
# 另一个终端：
cd apps/web
node scripts/run-playwright.mjs test \
  tests/expert-delivery.spec.ts tests/expert-revision-input.spec.ts \
  tests/expert-match.spec.ts tests/experts.spec.ts tests/conversation.spec.ts \
  tests/task-skills.spec.ts tests/presentation-composer.spec.ts \
  tests/word-pro.spec.ts tests/skill-products.spec.ts
```
