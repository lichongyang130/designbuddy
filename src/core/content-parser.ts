/**
 * DesignBuddy 商业级 PPT 生成器 — 内容解析器
 *
 * 职责：从用户提示词（prompt）中解析出结构化的课程表内容字段。
 * 预留 PDF 文本解析接口，后续可接入真实 PDF 文字提取。
 *
 * @module designbuddy/core/content-parser
 */

export interface ParsedContent {
  /** 学校全称 */
  schoolName: string
  /** 学校简称（用于页脚等简略场景） */
  schoolShortName?: string
  /** 学期 */
  semester: string
  /** 学年 */
  academicYear: string
  /** 科目列表 */
  subjects: string[]
  /** 星期列表 */
  days: string[]
  /** 每天节次数 */
  periodsPerDay: number
  /** 联系电话 */
  contactPhone?: string
  /** 校训 */
  motto?: string
  /** 办学理念 */
  schoolVision?: string
}

/** 默认科目集合（小学通用） */
const DEFAULT_SUBJECTS = ['语文', '数学', '英语', '科学', '音乐', '美术', '体育', '品社', '劳动']
/** 默认星期 */
const DEFAULT_DAYS = ['周一', '周二', '周三', '周四', '周五']

/**
 * 从提示词中解析结构化内容。
 * 当前为基于正则/关键词的规则解析，覆盖常见中文提示词；
 * 如需更精准可在此接入 LLM 或 PDF 文字提取。
 */
export function parsePrompt(prompt: string): ParsedContent {
  const schoolMatch = prompt.match(/([^\s。,，]+?小学)/)
  const schoolName = schoolMatch ? schoolMatch[1] : '未命名学校'

  // 尝试提取学年/学期
  const yearMatch = prompt.match(/(\d{4})\s*学年/)
  const academicYear = yearMatch ? yearMatch[1] : '2026'
  const semesterMatch = prompt.match(/(春季|秋季)\s*学期/)
  const semester = semesterMatch ? `${semesterMatch[1]}学期` : '秋季学期'

  return {
    schoolName,
    schoolShortName: schoolName.replace('小学', ''),
    semester,
    academicYear,
    subjects: [...DEFAULT_SUBJECTS],
    days: [...DEFAULT_DAYS],
    periodsPerDay: 5,
    contactPhone: '',
    motto: '勤学 明理 健体 创新',
    schoolVision: '让每一个孩子都能在学校找到适合自己的成长节奏',
  }
}

/**
 * 预留：从 PDF 提取的纯文本中解析内容。
 * 入参为已提取的 PDF 文本字符串，返回可合并到 ParsedContent 的部分字段。
 */
export function parsePdfText(pdfText: string): Partial<ParsedContent> {
  // TODO: 接入真实 PDF 文字提取后在此实现关键字抽取
  const result: Partial<ParsedContent> = {}
  const schoolMatch = pdfText.match(/([^\s。,，]+?小学)/)
  if (schoolMatch) result.schoolName = schoolMatch[1]
  return result
}
