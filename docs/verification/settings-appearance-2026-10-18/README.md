# 设置 → 外观（按 2026-10-18 参考界面重建，控件全部真实生效）

- 参考截图：`reference.png`（819×784，1× 像素）
- 渲染结果：`rendered-settings-appearance.png`（设置弹窗）、`rendered-settings-appearance-section.png`（外观区块）、`rendered-settings-appearance-dark.png`（深色模式）
- 读取方式：sharp 逐像素采样 + tesseract.js（chi_sim+eng）OCR，坐标均为程序测量。

## 一、参考界面的结构（1× 坐标）

| 元素 | 位置 | 样式 |
| --- | --- | --- |
| `界面样式` | x54–105，y46–62 | ~16px 加粗 `#141414` |
| 分隔线 | y=83，x44–785 | 1px，两端 `#e6e6e6` → 中间 `#fbfbfb` 的横向渐变 |
| `主题模式` + 下拉 + 图标按钮 | 标题 y100–113；下拉 120×28（y105–132）；图标按钮 40×28，间距 8px | 1px `#e6e6e6` 圆角边框 |
| 四张样式预览卡 | y154–253，每张 159 宽，间距 12px | 卡内是迷你窗口：顶条 + 左侧色块 + 右上圆环 + 内容面板与占位线；名字居中 |
| 七个设置行 | 行高 71px，分隔线 y=293/364/435/506/577/648/719 | 左标题 + 灰说明，右控件垂直居中（下拉 124×28 / 开关 49×20） |

参考行：终端主题、终端链接使用内置浏览器、语言、字体风格、内容宽度、文件图标、模糊与玻璃效果。

## 二、第一版留下的占位（已在第二版全部修掉）

第一版为了对齐截图，把接不上的控件做成了 `disabled`，四张预览卡是静态图形。
这些占位在本次全部替换：

| 第一版（占位） | 第二版（真实） | 落地方式 |
| --- | --- | --- |
| 终端主题（disabled 下拉） | **控制台主题** | 本产品没有终端，最接近的真实对象是技能执行台的运行记录/日志区；新增 `consoleTheme` 偏好，作用于 `html[data-console-theme]` |
| 终端链接使用内置浏览器（disabled 开关） | **链接打开方式** | 本产品没有终端与内置浏览器；改为已有的 `linkMode`（智能 / 新标签页 / 当前标签页），与 通用 分区共用同一 store |
| 字体风格（disabled 下拉） | **真实字族** | 新增 `fontStyle` 偏好（无衬线 / 衬线），作用于 `html[data-font-style]`，切换后整个界面立即换字形（`pre/code` 保持等宽） |
| 内容宽度（disabled 下拉） | **真实宽度** | 新增 `contentWidth` 偏好（窄 680 / 标准 920 / 宽 1320px），作用于任务正文与输入框的 `max-width` |
| 文件图标（disabled 下拉） | **真实图标配色** | 新增 `fileIcons` 偏好（彩色按类型 / 单色中性灰）；`HomeIcon` 输出 `data-icon`，CSS 按类型上色 |
| 模糊与玻璃效果（disabled 开关） | **真实毛玻璃开关** | 新增 `glassEffects` 偏好，关闭时把 5 处 `backdrop-filter`（`.db-library-overlay`、`.profile-modal-backdrop`、`.ai-cover-tag`、`.scene-preview-dialog::backdrop`、`.pm-dialog::backdrop`）改为实色 |
| 森林 / 节能 / 蜜蜂 / 羊皮纸 四张静态卡 | **三张真实主题卡** | 跟随系统 / 浅色 / 深色，`role="radio"` 可点，`aria-checked` 反映当前主题，预览配色取自主界面在对应模式下的真实颜色 |

两处改名是因为原名字描述的能力不存在：**终端主题 → 控制台主题**、**终端链接使用内置浏览器 → 链接打开方式**。

## 三、实现

| 文件 | 改动 |
| --- | --- |
| `frontend/workspace/settingsStore.ts` | 新增 `ConsoleTheme` / `FontStyle` / `ContentWidth` / `FileIconStyle` 类型、四个偏好字段与默认值、`sanitizePreferences` 校验、五个 setter |
| `apps/web/src/App.tsx` | 把五个偏好写入 `html[data-console-theme]`、`[data-font-style]`、`[data-content-width]`、`[data-file-icons]`、`[data-glass]`；控制台主题跟随系统时随界面主题与系统深色联动 |
| `apps/web/src/components/SettingsSections.tsx` | `AppearanceSettings` 重写：九个真实行 + 三张可点主题卡 |
| `apps/web/src/components/HomeIcon.tsx` | 输出 `data-icon={name}`，供文件图标配色使用 |
| `apps/web/src/components/settings-window.css` | 主题卡改为三列、可点与选中态，配色由 `[data-theme-preview]` 决定 |
| `apps/web/src/theme.css` | 字族、内容宽度、毛玻璃关闭、文件图标配色、控制台主题、深色与紧凑模式覆盖 |
| `frontend/workspace/i18n.ts` | 中英文文案键替换（删掉 forest/eco/honey/parchment 等占位键） |
| `apps/web/tests/settings-appearance.spec.ts` | 4 条用例：版式与配色、控件全部真实、链接与密度与 通用 同步、界面语言 |

### 无障碍名称为什么和可见标题略有不同

语言下拉的可达名是 `界面语言`、链接打开方式下拉是 `界面链接打开方式`，
目的是不与 **通用** 分区里同名的 `语言`、`链接打开方式` 冲突（`account.spec.ts` 用 `exact: true` 定位后者）。

## 四、验证

```
apps/web: settings-appearance.spec.ts            4 passed
apps/web: settings-p0.spec.ts -g "appearance"    1 passed
apps/web: account.spec.ts +
          settings-profile-plan.spec.ts +
          settings-plan-credits.spec.ts          12 passed / 4 failed
```

- 4 条失败是基线就有的：`account.spec.ts` 的「settings and menu fit …」四档视口 —— 设置窗口的
  `关闭设置` 与模型弹窗的 `.settings-model-dialog__close` 同名，`getByRole` 严格模式冲突；
  该按钮在基线 `8d9331c` 就已存在，与本次改动无关（已用 stash 在 `50b2986` 上复现同款失败）。
- 用例断言覆盖：`select:disabled` 与 `button[role=switch]:disabled` 数量为 0；主题卡点击后
  `html[data-theme]` 与 `aria-checked` 同步；控制台主题、内容宽度（`--db-content-max` 680/920/1320）、
  文件图标、毛玻璃开关都改变了文档属性或计算样式；字体风格切到衬线后 `body` 的 `font-family` 命中 Georgia；
  链接打开方式与密度刷新后仍生效，且与 通用 分区的同一个下拉保持同步。
- 渲染核对：三张主题卡等宽一行，浅色卡背景 `rgb(246,247,249)`、深色卡 `rgb(23,26,33)`；
  OCR 复核渲染图，九个标题、说明文字与下拉当前值全部正确。

## 五、与参考界面的差异

| 项 | 参考 | 渲染 | 原因 |
| --- | --- | --- | --- |
| 区块宽度 | 819 | 642 | 设置弹窗宽度固定 |
| 预览卡 | 4 张配色卡 | 3 张真实主题卡 | 本产品只有三套主题，第四套不存在 |
| 两行标题 | 终端主题 / 终端链接 | 控制台主题 / 链接打开方式 | 没有终端，改为真实存在的能力 |
| 毛玻璃开关 | 关闭 | 默认开启 | 真实默认值跟随界面实际行为（当前使用毛玻璃） |
| 文件图标值 | `Qoder` | 彩色 / 单色 | 换成真实可选的两档配色 |
| 额外一行 | 无 | 界面密度 | 本产品真实生效的设置，不能因改版消失 |
| 说明文字 | 单行 | 2–3 行 | 面板更窄，文案未改 |
