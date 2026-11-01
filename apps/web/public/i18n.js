/**
 * 界面语言：中 → 英 词典 + 即时翻译。
 *
 * 静态文案与设置项走同一份词典；聊天记录、文档抽取结果、代码块不翻译。
 * 切回中文时用首次记录的原值恢复，避免二次翻译。
 */

const EN = {
  // 顶栏 / 导航
  '专家': 'Experts',
  '技能': 'Skills',
  '连接器': 'Connectors',
  '我的专家': 'My experts',
  '添加技能': 'Add skill',
  '自定义连接器': 'Custom connector',
  '全部': 'All',
  '综合': 'Overall',
  '最热': 'Popular',
  '最新': 'Newest',
  '精选技能': 'Featured skills',
  '换一批': 'Refresh',
  '推荐': 'Recommended',
  '套件': 'Suites',
  '办公能力': 'Office tools',
  'PPTX 阅读器': 'PPTX reader',
  'Word 文档处理': 'Word documents',
  'Word 公式处理': 'Word equations',
  'Excel 表格': 'Excel sheets',
  'PDF 文本提取': 'PDF text',
  '更多': 'More',
  '设置': 'Settings',
  '模版': 'Templates',

  // 首页 / 工作区
  '带上您已有的内容': 'Bring what you already have',
  '从空白新建': 'Start blank',
  '创建': 'Create',
  '升级获得更多 AI 功能': 'Upgrade for more AI',
  '使用经典版生成工具': 'Use classic generator',
  '最近的对话记录': 'Recent chats',
  '最近的 gammas': 'Recent gammas',
  '搜索': 'Search',
  '与您共享': 'Shared with you',
  '网站': 'Websites',
  'API 生成': 'API generation',
  '文件夹': 'Folders',
  '将相关的 gammas 分组，并一次性全部分享。': 'Group related gammas and share them at once.',
  '创建文件夹': 'Create folder',
  '垃圾箱': 'Trash',
  '邀请成员': 'Invite members',
  '推荐模板': 'Recommended templates',
  '查看所有模板': 'View all templates',
  '演示文稿': 'Slides',
  '文档': 'Document',
  '轮播图': 'Carousel',
  '图片': 'Image',
  '美化': 'Beautify',
  '导入': 'Import',
  '示例指令': 'Example prompts',
  '新建': 'New',

  // 对话
  '首页': 'Home',
  '新对话': 'New chat',
  '返回': 'Back',

  // 设置导航
  '功能': 'Features',
  '数据与安全': 'Data & security',
  '个人主页': 'Profile',
  '套餐与积分': 'Plan & credits',
  '外观': 'Appearance',
  '快捷键': 'Shortcuts',
  '个性化': 'Personalization',
  '记忆与进化': 'Memory',
  '智能体': 'Agents',
  '模型': 'Models',
  '助理': 'Assistant',
  '设备连接': 'Devices',
  '对话流': 'Dialogue',
  '数据管理': 'Data',
  '应用管理': 'Apps',

  // 通用面板
  '常规': 'General',
  '通用': 'General',
  '语言': 'Language',
  '链接打开方式': 'Link opening',
  '设置 WorkBuddy 对话中链接的默认打开策略。': 'Choose how links in WorkBuddy open.',
  '字体大小': 'Font size',
  '小': 'Small',
  '大': 'Large',
  '默认': 'Default',
  '默认打开方式': 'Default open method',
  '设置用 WorkBuddy 独立文件浏览器打开本地文件的默认方式。': 'Choose how local files open in the file browser.',
  '权限': 'Permissions',
  '允许锁屏运行': 'Run while locked',
  '选择锁屏后的运行方式，保障远程控制与后台 Agent 任务持续执行。': 'Choose how tasks keep running while locked.',
  '运行时防止系统休眠': 'Prevent sleep while running',
  '在 WorkBuddy 运行任务时，让电脑保持唤醒状态。': 'Keep the computer awake while WorkBuddy is running.',
  '开机自动启动': 'Launch at login',
  '开启后 WorkBuddy 会在你登录电脑后自动启动。': 'Launch WorkBuddy automatically after you sign in.',
  '网络代理': 'Network proxy',
  '网络异常时可切换连接方式，修改后立即生效': 'Switch connection mode if the network misbehaves.',
  '自动安装可信技能': 'Auto-install trusted skills',
  '自动安装来自可信来源的技能，扩展 Agent 能力。': 'Install skills from trusted sources automatically.',
  '关闭': 'Off',
  '允许': 'Allow',
  '仅后台任务': 'Background only',
  '内置打开': 'In-app',
  '系统浏览器': 'System browser',
  '直接连接': 'Direct',
  '系统代理': 'System proxy',
  '自定义代理': 'Custom proxy',

  // 各栏目
  '身份': 'Identity',
  '工作区': 'Workspace',
  '当前工作区名称': 'Workspace name',
  '计划': 'Plan',
  '会话数': 'Sessions',
  '本进程内创建过的会话': 'Sessions created in this process',
  '成员': 'Members',
  '1（本地）': '1 (local)',
  '打开工作区': 'Open workspace',
  '关闭设置并回到首页': 'Close settings and return home',
  '打开': 'Open',
  '当前计划': 'Current plan',
  '剩余额度': 'Remaining quota',
  '演示值，不接计费': 'Demo value, not billed',
  '已产生会话': 'Sessions created',
  '已产生消息': 'Messages created',
  '升级到 Pro': 'Upgrade to Pro',
  '解锁 Max 档位与更高额度': 'Unlock Max and a higher quota',
  '升级': 'Upgrade',
  '即时生效，保存在本地': 'Applies instantly, stored locally',
  '界面密度': 'Density',
  '舒适': 'Comfortable',
  '紧凑': 'Compact',
  '等宽字体': 'Monospace',
  '聊天气泡与工具输出使用等宽字体': 'Use monospace for chat and tool output',
  '打开命令面板': 'Command palette',
  '搜索会话、专家与工具': 'Search sessions, experts and tools',
  '发送消息': 'Send message',
  '在任一输入框中发送': 'Send from any input',
  '关闭弹层': 'Close overlays',
  '菜单、抽屉与设置': 'Menus, drawer and settings',
  '快捷键当前固定，暂不支持自定义。': 'Shortcuts are fixed for now.',
  '称呼': 'Name',
  '用于界面问候，不写入会话': 'Used for greetings, not saved to sessions',
  '回复语气': 'Tone',
  '仅本地偏好，不改变后端': 'Local preference only',
  '平衡': 'Balanced',
  '简洁': 'Concise',
  '详尽': 'Detailed',
  '这些偏好保存在浏览器 localStorage，不会发送到后端。': 'Stored in localStorage; never sent to the backend.',
  '设计记忆（会进入系统提示词）': 'Design memory (goes into the system prompt)',
  '暂无设计决策': 'No decisions yet',
  '保存后会进入系统提示词': 'Saved entries go into the system prompt',
  '新增决策': 'Add decision',
  '主题，例如「圆角」': 'Topic, e.g. "radius"',
  '内容，例如「统一 8px」': 'Content, e.g. "8px everywhere"',
  '写入': 'Save',
  '默认专家：': 'Default expert: ',
  '设为默认': 'Set default',
  '适配器': 'Adapters',
  '未注册适配器': 'No adapters',
  '装载 llm 适配器插件后出现': 'Appears after mounting an LLM adapter',
  '路由策略': 'Routing policies',
  '无路由策略': 'No policies',
  '候选链（按顺序回退）': 'Candidate chain (fallback in order)',
  '最近调用': 'Recent calls',
  '尚无调用': 'No calls yet',
  '发起一次对话后这里会记录': 'Appears after your first chat',
  '成功': 'OK',
  '失败': 'Failed',
  '默认助理': 'Default assistant',
  '新建会话使用的 preset': 'Preset for new sessions',
  '完成后返回首页': 'Return home when done',
  'Agent 结束时自动切回首页': 'Switch home when the agent finishes',
  '重置为设计经理': 'Reset to design manager',
  '恢复 manager preset': 'Restore the manager preset',
  '重置': 'Reset',
  '暂无连接器': 'No connectors',
  '装载连接器插件后出现': 'Appears after mounting a connector',
  '已连接': 'Connected',
  '未装载': 'Not mounted',
  '断开': 'Disconnect',
  '当前专家': 'Current expert',
  '最大步数': 'Max steps',
  '单次对话最多调用模型的次数': 'Max model calls per chat',
  '默认 6': 'Default 6',
  '显示工具结果': 'Show tool results',
  '关闭后聊天里只保留文字': 'Hide tool output in chat',
  '自动滚动': 'Auto-scroll',
  '新消息到达时滚动到底部': 'Scroll to bottom on new messages',
  '会话数据': 'Session data',
  '暂无会话': 'No sessions',
  '发送一条消息后出现在这里': 'Appears after you send a message',
  '导出': 'Export',
  '清空界面会话': 'Clear this view',
  '只清空当前窗口显示，不删除服务端记录': 'Only clears this view, keeps server records',
  '清空': 'Clear',
  '运行时装卸插件。卸载会撤销该插件注册的服务、工具与提示词分节。': 'Mount and unmount plugins at runtime. Unloading removes their services, tools and prompt sections.',
  '当前工具': 'Current tools',

  // 办公面板
  '操作': 'Action',
  '来源': 'Source',
  '上传': 'Upload',
  '本地路径': 'Local path',
  '动作': 'Action',
  '保存到': 'Save to',
  '运行': 'Run',
  '提取公式（LaTeX）': 'Extract formulas (LaTeX)',
  '给显示公式编号': 'Number display formulas',
  '选择文件后点「运行」。': 'Choose a file, then click Run.',
  '上传模板': 'Upload template',
  '浏览模板': 'Browse templates',
  '添加文件': 'Add file',
  '模式': 'Mode',
  '努力': 'Effort',
  '越多的需求将消耗更多的使用额度': 'More demand uses more quota',
  '标准': 'Standard',

  // 徽标
  '未接入': 'Not connected',
  '仅桌面版': 'Desktop only',
  '演示': 'Demo',
  '已接入': 'Connected',
}

const originals = new WeakMap()
const attrOriginals = new WeakMap()
let lang = 'zh'

export function currentLanguage() {
  return lang
}

export function t(text) {
  return lang === 'en' ? (EN[text] ?? text) : text
}

function skipNode(node) {
  const parent = node.parentElement
  if (!parent) return true
  const tag = parent.tagName
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return true
  return parent.closest('#opResult, .thread, pre, code, .msg, #chatTitle, #chatSid, .op-result') !== null
}

function translateTextNode(node) {
  const stored = originals.get(node) ?? node.nodeValue ?? ''
  if (!originals.has(node)) originals.set(node, stored)
  const trimmed = stored.trim()
  if (trimmed === '') return
  const next = lang === 'en' ? EN[trimmed] : undefined
  if (lang === 'en' && next) node.nodeValue = stored.replace(trimmed, next)
  else if (lang === 'zh') node.nodeValue = stored
}

function translateAttributes() {
  for (const el of document.querySelectorAll('[placeholder], [title]')) {
    const store = attrOriginals.get(el) ?? new Map()
    attrOriginals.set(el, store)
    for (const name of ['placeholder', 'title']) {
      const value = el.getAttribute(name)
      if (value == null) continue
      if (!store.has(name)) store.set(name, value)
      const original = store.get(name)
      const trimmed = original.trim()
      if (trimmed === '') continue
      if (lang === 'en' && EN[trimmed]) el.setAttribute(name, original.replace(trimmed, EN[trimmed]))
      else if (lang === 'zh') el.setAttribute(name, original)
    }
  }
}

export function applyLanguage(next) {
  lang = next === 'en' ? 'en' : 'zh'
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return skipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) translateTextNode(node)
  translateAttributes()
}

export function startAutoTranslate() {
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (lang !== 'en' || scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      applyLanguage('en')
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
