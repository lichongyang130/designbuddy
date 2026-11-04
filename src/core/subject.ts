/**
 * 需求文字 → 主题 / 受众。演示文稿和「文档 / 图片 / 轮播图」共用这一份，
 * 免得两边各写一套正则、同一句话在两处读成两个意思。
 *
 * @module designbuddy/core/subject
 */

/**
 * 主题 = 需求里那一句话，剥掉三样东西：命令壳子、量词页数、格式后缀。
 * 早先是一串「这些不是主题」的正则整句删，把「使用手册」删成了「使 手册」，
 * 也把「给产品团队做一份季度复盘」整句当成了主题，生成的文案因此读不通。
 * 现在按结构剥：从句首剥命令和受众，从量词处断，从尾部剥格式词，只动完整词。
 */
const CMD_LEAD = /^(?:请|麻烦|帮我|帮忙|给我|替我|我要|我想|想要|需要|能不能|可以)?\s*(?:帮我|帮忙|给我|替我|请)?\s*/
const CMD_VERB =
  /^(?:来|去)?(?:制作|做|生成|写|整理|准备|策划|设计|出|搞|弄|起草|安排|讲|聊|说|介绍|分享)(?:个|份|篇|张|屏|页)?\s*/
const QUANT = /^(?:一|两|三|四|五|六|七|八|九|十|\d+)\s*(?:份|个|套|版|篇|页的|页)\s*/
/** 句首的数量词：「10 页的复盘」「6 屏的轮播图」——页数已经单独读了，不该留在主题里。 */
const LEAD_COUNT = /^\d+\s*(?:页|屏|张|章|节|个|份|幅|组)(?:的)?\s*/
const SHELL_TAIL =
  /(?:PPT|ppt|Ppt|幻灯片|演示文稿|演示文档|演示|材料|文档|报告|方案|deck|Deck|slides|slide|presentation|大纲|轮播图|九宫格|海报|图片|插图|长图)$/
const AUDIENCE_LEAD = /^(?:面向|受众是|讲给|针对|给|为)\s*/
const AUDIENCE_CUT = /(?:做|制作|生成|写|整理|准备|策划|设计|讲|介绍|分享|汇报|一份|一个|的)/
/** 用途词只在一句话里还有别的内容时才算壳子：单说「季度汇报」不能只剩「季度」。 */
export const PURPOSE_SHELL =
  /(?:商业发布会|产品发布会|发布会|产品发布|路演|融资|汇报|培训|分享会|宣讲|内部分享|提案|总结|复盘|报告)/g
export const STYLE_SHELL = /(?:科技未来感|科技未来|科技感|未来感|赛博|深色|暗色|极简风|极简|商务感|商务|正式|稳重|活力|高端|克制|年轻化|年轻)/g

const STOP_WORDS = ['的', '了', '和', '与', '及', '是', '在', '为', '把']
/** 只剩产出类型本身，不是主题。 */
const SHELL_ONLY = /^(?:PPT|ppt|幻灯片|演示文稿|演示|文档|报告|材料|方案|轮播图|九宫格|海报|图片|插图|长图|大纲|deck)$/

/** 一句话里的第一个短语（按标点断），用来取主题。 */
export function firstClause(prompt: string): string {
  return prompt.split(/[，。；、,.;:：!！?？\n]+/).map((part) => part.trim()).find((part) => part !== '') ?? ''
}

export function squeeze(text: string): string {
  return text.replace(/[“”"'（）()【】\[\]《》]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 一句里剥命令、受众、量词、格式后缀；剥空了就返回空串，由调用方看下一句。 */
function subjectIn(clause: string): string {
  let text = squeeze(clause.replace(/^关于\s*/, ''))
  for (let guard = 0; guard < 4; guard += 1) {
    const before = text
    // 受众写在了主题前面：「给产品团队做一份…」→「一份…」，所以受众先剥
    if (AUDIENCE_LEAD.test(text)) {
      const rest = text.replace(AUDIENCE_LEAD, '')
      const cut = rest.search(/(?:制作|做|生成|写|整理|准备|策划|设计|出|讲|介绍|分享|汇报)/)
      // 「面向新员工的产品使用手册」：受众后面的「的」也是断点，留下的才是被描述的东西
      if (cut > 0) text = rest.slice(cut)
      else if (rest.includes('的')) text = rest.slice(rest.indexOf('的') + 1)
      else if (!/^\d/.test(rest)) text = rest
    }
    text = text.replace(CMD_LEAD, '').replace(CMD_VERB, '').replace(/^关于\s*/, '').replace(/^(?:的|了|个|份)\s*/, '')
    text = squeeze(text.replace(QUANT, '')).replace(LEAD_COUNT, '')
    // 格式词可能叠两层：「商业发布会 PPT」→ 先剥 PPT，再剥发布会
    for (let tail = 0; tail < 2; tail += 1) text = squeeze(text.replace(SHELL_TAIL, '').replace(/的$/, ''))
    text = squeeze(text)
    if (text === before) break
  }
  return text
}

/**
 * 主题：一句句试，第一句剥空了就看下一句。
 * 「做一份 6 屏的轮播图，讲通勤咖啡」第一句只剩「轮播图」这种类型词，真正的内容在第二句。
 */
export function subjectOf(prompt: string): string {
  const clauses = prompt.split(/[，。；、,.;:：!！?？\n]+/).map((part) => part.trim()).filter((part) => part !== '')
  let first = ''
  for (const clause of clauses.slice(0, 3)) {
    const text = subjectIn(clause)
    if (text === '') continue
    if (first === '') first = text
    // 只剩类型词（「轮播图」「PPT」）不算主题，接着看下一句
    if (!SHELL_ONLY.test(text)) return text
  }
  return first
}

/** 受众：用户原话里的「面向 X / 给 X / 为 X」，切到动词或量词为止。 */
export function audienceOf(prompt: string): string | undefined {
  for (const clause of prompt.split(/[，。；,.;\n]+/)) {
    const text = clause.trim()
    const match = text.match(/(?:面向|受众是|讲给|针对)\s*([^\s]+)/) || text.match(/^(?:请|麻烦|帮我|帮忙)*\s*[给为]\s*([^\s]+)/)
    if (!match) continue
    let who = match[1]!.replace(AUDIENCE_LEAD, '')
    const cut = who.search(AUDIENCE_CUT)
    if (cut > 0) who = who.slice(0, cut)
    who = squeeze(who.replace(/^(?:了|的)/, ''))
    if (who.length >= 2 && who.length <= 12 && !/^(?:帮我|做|写|生|制|整|准|策|设|出|来)/.test(who) && !/PPT|ppt|页/.test(who)) return who
  }
  return undefined
}
