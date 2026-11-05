// Explicitly rule-based suggestions; never execute a task without user selection.
export const TASKS=[
 {id:'beautify',label:'美化文件',icon:'✦',description:'优化当前成果的排版与样式',examples:['美化文档排版'],keywords:/美化|优化.*排版|调整.*样式|更换.*风格/},
 {id:'search',label:'找资料',icon:'⌕',description:'在所选文件中查找相关内容',examples:['找到财务部上个月的预算表'],keywords:/查找|寻找|找出|找.*文件|找.*资料|搜索|检索/},
 {id:'excel',label:'处理表格',icon:'▦',description:'合并、检查和统计 Excel',examples:['合并部门预算表并检查重复'],keywords:/excel|xlsx|电子表格|预算表|合并.*表|统计.*表|表格/i},
 {id:'word',label:'写文档',icon:'▤',description:'起草通知、报告与总结',examples:['参考旧通知写一份工作通知'],keywords:/word|docx|公文|通知|报告|总结|文稿|文档/i},
 {id:'tasks',label:'记任务、跟进',icon:'✓',description:'手动记录交办、责任人和进度',examples:['记录领导交办事项并跟进进度'],keywords:/领导交办|交办事项|待办|任务跟进|任务进度|工作进度|工作日报|工作周报/},
 {id:'collection',label:'收材料',icon:'◇',description:'核对部门名单，生成催办',examples:['收集各部门月度总结并核对未交名单'],keywords:/收集|收材料|催办|未交|未提交|提交名单/},
 {id:'ppt',label:'做汇报',icon:'▧',description:'制作和编辑演示文稿',examples:['根据资料制作汇报 PPT'],keywords:/ppt|演示文稿|幻灯片|汇报.*演示/i},
 {id:'meeting',label:'整理会议',icon:'◷',description:'录音转写和纪要 · 规划中',examples:['整理会议录音并提取待办'],keywords:/会议录音|会议纪要|录音转写/},
 {id:'review',label:'比较文件版本',icon:'⇄',description:'逐行比较 TXT 与 DOCX 正文',examples:['比较两份合同的正文差异'],keywords:/对比|比较|版本差异|合同.*差异/},
 {id:'crossreview',label:'核对文档与表格数字',icon:'⇄',description:'手动选择文档数字与 Excel 单元格',examples:['核对 Word 和 Excel 的数字'],keywords:/核对.*数字|数字.*不一致|数据.*对不上/},
 {id:'messages',label:'处理消息',icon:'✉',description:'分类、回复和跟进 · 规划中',examples:['整理重要通知和待回复邮件'],keywords:/邮件|微信|消息|回复|待回复/},
 {id:'automation',label:'自动化',icon:'↻',description:'定时与常用流程 · 规划中',examples:['每月自动制作部门汇总'],keywords:/自动化|定时|定期|每月自动|每周自动/},
 {id:'knowledge',label:'知识库',icon:'▥',description:'资料归档与交接 · 规划中',examples:['整理历史资料和交接流程'],keywords:/知识库|交接|归档|操作规范/},
]
export function suggestTasks(text){const s=String(text||'').trim();return s?TASKS.filter(t=>t.keywords.test(s)).map(t=>t.id):[]}
export function planFor(ids){return ids.map(id=>TASKS.find(t=>t.id===id)).filter(Boolean)}
export function safeFileLabel(name){return String(name||'文件').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').slice(0,80)}
