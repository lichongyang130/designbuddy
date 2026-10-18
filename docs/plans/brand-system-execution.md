# 第七批：品牌系统与标志资产真实执行

更新：2026-10-16。新增 `brand.system@1.0.0`，绑定“品牌视觉专家”。属于品牌方案/资产制作的**确定性结构化子集**：不是AI生图、不是生成式品牌创意、不是定制标志设计师，也不代表品牌专家全部高级能力完成。

## 使用

进入“专家 → 品牌视觉专家 → 真实技能执行台”，选“品牌系统与标志资产导出”，使用下方示例或提交自己的严格JSON简报。检查文字和配色；同意上传并单击“上传并执行技能”后，后台实际生成成果。

```json
{
  "brandName":"林间来信",
  "description":"以植物灵感制作日常文具。",
  "concept":"让每一次书写都留住细小观察。",
  "tagline":"把日常写进自然",
  "voice":"安静、明朗、具体，不夸张承诺。",
  "logoShape":"seed",
  "colors":[
    {"name":"森林墨绿","role":"primary","hex":"#294C3B"},
    {"name":"雾感米白","role":"surface","hex":"#F3EFE4"},
    {"name":"柿子橙","role":"accent","hex":"#D67A4A"}
  ]
}
```

所有字段必填（口号可为空），JSON必须只含示例的七个顶层字段；简介≤500、理念≤240、品牌名≤32、口号≤60、语气≤240字符。拒绝双向文本控制字符、控制码和未知字段。仅支持三种内置构形：`seed`、`orbit`、`spark`。必须指定3–5种名称/用途/六位HEX色；颜色代码与用途不得重复。严格UTF-8，输入≤2MB。

## 实际生成的8份文件

1. `logo-symbol.svg`：白底圆角符号，实际矢量几何路径。
2. `logo-lockup.svg`：符号、中文/其他已覆盖字符的字标轮廓及可选口号；字标转成本机字体真实glyph路径，不含可执行脚本/网页`<text>`。
3. `brand-icon-64.png`、`brand-avatar-512.png`：由SVG经Sharp实际解码栅格化的PNG，不是扩展名改写。
4. `brand-system.json`：品牌简介、理念、语气、构形、色彩对比、建议字体/字级、使用建议和明确的限制。
5. `brand-system.css`：自定义色彩与文字级别变量。
6. `brand-guidelines.html`：响应式、文字转义的品牌规范草案、嵌入字标、色板及对比参考。
7. `font-license.txt`：打包字形许可正文。

系统使用本地Noto字体路径绘制SVG字标。可交付CSS字体栈是`Noto Sans SC, Noto Sans, sans-serif`，供品牌方在其产品中自行安装/加载字体；CSS变量文件不打包字体。**独立HTML规范则仅把其中实际使用的Noto WOFF2子集内嵌为data URI**，无需网络即可在没有系统中文字体的浏览器呈现该规范的简体中文、拉丁文；测试验证字体可用并检查桌面/移动截图。品牌方在此HTML自行新增文本时，须确认系统字体或提供对应字形。HTML嵌入已转义的字标SVG数据，不插入用户HTML。颜色对比按sRGB黑/白字计算并保留两位小数，是工具建议值，不是完整WCAG/整站认证。

## 如实边界

- 名称、语气和颜色均由用户声明，工具不做AI推理、品牌定位访谈、商业/文化研究或竞品分析。
- 几何标记是三套确定性图形规则的输出；不是语义理解、独占设计或审美原创性证明。没有品牌名/商标库/API检索，没有版权相似性检测、域名检索、注册申请或法律意见；**不能承诺可注册、无冲突、版权归属或全球独家**。
- 不会从外网取素材、接图像生成模型或制作任意复杂插画。客户使用前自行复核文字、文化寓意、市场适配、商标/版权/字体权利，并由设计人员评审和修改。
- 无衬线字级和色彩用途仅为初稿；小尺寸、真实纸张、暗色背景、渐变和色盲条件均未做视觉/无障碍验证。
- 文件通过原有同意、执行队列和所有者隔离持久保存。默认可选ASR模型若未安装仅影响ASR技能，不影响本技能。

## 实测范围

`server/skills/brand-system.test.cjs`十项：结构/字段/颜色/字符校验，转义与活动标记防护，三种几何构形的SVG与真实PNG尺寸/签名，变量和内容改变后的实际产物，字体许可，明确绑定，以及内存SQLite服务队列创建、成功、8份文件下载校验、哈希/禁用缓存头和跨所有者404。

[持久证据目录](../verification/brand-system-2026-10-16/README.md)由`node scripts/verify-brand-system.cjs`通过真实worker生成8项文件，服务层在内存数据库运行，另保存原输入和SHA-256清单；不触碰应用数据库。详见[真实产物、屏幕截图与日志](../verification/brand-system-2026-10-16/README.md)。

- 本工作区没有原先可选PocketSphinx忽略模型；全套技能命令运行时，该模型真实识别测试不能通过，**不得算通过或跳过**。排除仅该可选ASR测试文件，其余**136项服务端/接口回归通过**（含10项新增品牌专项）；实际浏览器品牌流程1/1、目录9/9、前后端TypeScript和生产构建通过。
- Chromium最初缺失；从npm注册表临时安装的Chromium包已在忽略缓存中解压运行，未添加产品依赖。真实浏览器通过实际上传/后台worker/下载8项资产+1执行凭据，检查离线内嵌字体并截取桌面/390px手机规范页。截图真实检查后，修复了首次发现的系统没有中文字库时中文显示方框问题；HTML现仅嵌入所用Woff2子集，不需远程请求。
- 相关验收非全站/所有12位专家/36业务案例；没有做商标搜索、市场试用或部署。

## 复验

```sh
corepack pnpm exec tsc -p server/tsconfig.local.json
node --test server/skills/brand-system.test.cjs
node scripts/verify-brand-system.cjs
node --test $(find server/skills server/api -name '*.test.cjs' ! -name audio-transcribe.test.cjs -print | sort)
corepack pnpm exec tsc --noEmit -p apps/web/tsconfig.json
corepack pnpm --filter designbuddy-web build
corepack pnpm --filter designbuddy-web exec playwright test brand-system.spec.ts # 本次通过，复验时需提供Playwright Chromium
```

本批未推送、未创建PR、未部署、未更新先前Google Drive备份。
