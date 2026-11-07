/**
 * DesignBuddy 商业级 PPT 生成器 — 幻灯片模板工厂
 *
 * 职责：根据解析内容 + 商业主题，生成 7 页商业级 PPT 幻灯片模型。
 * 所有元素均使用统一模型 PptElement，带稳定 ID，便于后续局部修改。
 *
 * @module designbuddy/core/slide-templates
 */

import type { PptPresentation, PptSlide, PptElement, PptTextStyle, PptShapeStyle } from './deck-model.ts'
import type { ParsedContent } from './content-parser.ts'
import type { CommercialTheme } from './commercial-theme.ts'
import { TEXT_SIZES, GRID, subjectColor } from './commercial-theme.ts'

const M = GRID.margin
const CW = GRID.contentWidth

function textStyle(
  overrides: Partial<{
    fontSize: number
    bold: boolean
    color: string
    align: 'left' | 'center' | 'right' | 'justify'
    valign: 'top' | 'middle' | 'bottom'
    lineHeight: number
  }> = {}
): PptTextStyle {
  return {
    fontSize: overrides.fontSize ?? TEXT_SIZES.body,
    bold: overrides.bold ?? false,
    color: overrides.color ?? '#17171B',
    align: overrides.align ?? 'left',
    valign: overrides.valign ?? 'top',
    lineHeight: overrides.lineHeight ?? 1.35,
    ...overrides,
  }
}

function shapeStyle(
  overrides: Partial<{
    fill: string
    stroke: string
    strokeWidth: number
    radius: number
    opacity: number
  }> = {}
): PptShapeStyle {
  return {
    fill: overrides.fill ?? '#FFFFFF',
    stroke: overrides.stroke,
    strokeWidth: overrides.strokeWidth,
    radius: overrides.radius,
    opacity: overrides.opacity ?? 1,
    ...overrides,
  }
}

function elText(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  style: PptTextStyle
): PptElement {
  return { id, type: 'text', x, y, w, h, text: content, style }
}

function elShape(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: 'rect' | 'roundRect' | 'ellipse' | 'line',
  style: PptShapeStyle
): PptElement {
  return { id, type: 'shape', x, y, w, h, shape: kind, style }
}

function elTable(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rows: string[][],
  theme: CommercialTheme,
  opts?: { headerFill?: string; headerColor?: string; zebra?: boolean }
): PptElement {
  return {
    id,
    type: 'table',
    x,
    y,
    w,
    h,
    rows,
    headerRow: true,
    zebra: opts?.zebra ?? true,
    headerFill: opts?.headerFill ?? theme.headerFill,
    headerColor: opts?.headerColor ?? theme.headerColor,
    borderColor: theme.rule,
  } as PptElement
}

export function buildSlides(content: ParsedContent, theme: CommercialTheme): PptSlide[] {
  const slides: PptSlide[] = []

  // ========== 1. 封面 ==========
  slides.push({
    id: 'slide-cover',
    title: '封面',
    layout: 'cover',
    background: { color: theme.paper },
    elements: [
      elShape('el-cover-bg', 0, 0, 1280, 720, 'rect', shapeStyle({ fill: theme.paper, opacity: 1 })),
      elShape('el-cover-accent', M, 260, 60, 6, 'rect', shapeStyle({ fill: theme.accent })),
      elText('el-cover-school', M, 150, CW, 100, content.schoolName, textStyle({
        fontSize: TEXT_SIZES.h1, bold: true, color: theme.accent, align: 'left', valign: 'middle',
      })),
      elText('el-cover-title', M, 260, CW, 80, '课程表', textStyle({
        fontSize: 48, bold: true, color: theme.ink, align: 'left', valign: 'middle',
      })),
      elText('el-cover-sub', M, 360, CW, 40, `${content.academicYear} 学年 · ${content.semester}`, textStyle({
        fontSize: TEXT_SIZES.small, bold: false, color: theme.muted, align: 'left', valign: 'middle',
      })),
      elText('el-cover-foot', M, 640, CW, 30, 'DesignBuddy 商业级 PPT 引擎导出 · 16:9 宽屏', textStyle({
        fontSize: TEXT_SIZES.foot, color: theme.rule, align: 'left', valign: 'middle',
      })),
    ],
  })

  // ========== 2. 学校概况 ==========
  slides.push({
    id: 'slide-overview',
    title: '学校概况',
    layout: 'statement',
    background: { color: theme.paper },
    elements: [
      elShape('el-ov-line', M, 110, 4, 32, 'rect', shapeStyle({ fill: theme.accent })),
      elText('el-ov-title', M + 20, 100, CW - 20, 44, '学校概况', textStyle({
        fontSize: TEXT_SIZES.h2, bold: true, color: theme.accent, align: 'left', valign: 'middle',
      })),
      elShape('el-ov-left-block', M, 170, CW / 2 - 50, 220, 'roundRect', shapeStyle({
        fill: theme.blockFill, radius: 12, opacity: 1,
      })),
      elText('el-ov-motto', M + 30, 190, CW / 2 - 80, 40, `校训：${content.motto}`, textStyle({
        fontSize: TEXT_SIZES.h3, bold: true, color: theme.accent, align: 'left', valign: 'middle',
      })),
      elText('el-ov-vision', M + 30, 240, CW / 2 - 80, 140, content.schoolVision, textStyle({
        fontSize: TEXT_SIZES.body, color: theme.ink, align: 'left', valign: 'top', lineHeight: 1.5,
      })),
      elShape('el-ov-right-block', M + CW / 2 + 20, 170, CW / 2 - 70, 220, 'roundRect', shapeStyle({
        fill: theme.cardFill, stroke: theme.cardStroke, strokeWidth: 1, radius: 12,
      })),
      elText('el-ov-scale-title', M + CW / 2 + 40, 190, CW / 2 - 110, 30, '办学规模', textStyle({
        fontSize: TEXT_SIZES.h3, bold: true, color: theme.ink, align: 'left', valign: 'middle',
      })),
      elText('el-ov-scale', M + CW / 2 + 40, 230, CW / 2 - 110, 140, '现有教学班 X 个，在校学生 X 名，专任教师 X 名。', textStyle({
        fontSize: TEXT_SIZES.body, color: theme.muted, align: 'left', valign: 'top', lineHeight: 1.5,
      })),
    ],
  })

  // ========== 3. 课程设置总览（科目卡片 3×3 网格） ==========
  const courseElements: PptElement[] = [
    elShape('el-course-line', M, 110, 4, 32, 'rect', shapeStyle({ fill: theme.accent })),
    elText('el-course-title', M + 20, 100, CW - 20, 44, '课程设置总览', textStyle({
      fontSize: TEXT_SIZES.h2, bold: true, color: theme.accent, align: 'left', valign: 'middle',
    })),
  ]
  const cols = 3
  const cardW = (CW - 40) / cols
  const cardH = 130
  content.subjects.forEach((subj, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = M + 20 + col * (cardW + 20)
    const cy = 170 + row * (cardH + 18)
    const sc = subjectColor(theme.scheme, subj)
    courseElements.push(
      elShape(`el-course-card-${subj}`, cx, cy, cardW, cardH, 'roundRect', shapeStyle({
        fill: theme.cardFill, stroke: sc, strokeWidth: 2, radius: 14,
      })),
      elText(`el-course-name-${subj}`, cx + 24, cy + 24, cardW - 48, 40, subj, textStyle({
        fontSize: TEXT_SIZES.h3, bold: true, color: sc, align: 'left', valign: 'middle',
      })),
      elText(`el-course-desc-${subj}`, cx + 24, cy + 72, cardW - 48, 44, `每周 ${3 + (i % 3)} 节课`, textStyle({
        fontSize: TEXT_SIZES.small, color: theme.muted, align: 'left', valign: 'top',
      }))
    )
  })
  slides.push({
    id: 'slide-courses',
    title: '课程设置总览',
    layout: 'columns',
    background: { color: theme.paper },
    elements: courseElements,
  })

  // ========== 4. 周课表（表格） ==========
  const days = content.days
  const periods = content.periodsPerDay
  const periodLabels = ['第1节', '第2节', '第3节', '第4节', '第5节'].slice(0, periods)
  const tableRows: string[][] = [['节次', ...days]]
  // 伪造课表数据：循环使用科目
  content.subjects.forEach((subj, pIdx) => {
    if (pIdx >= periods) return
    const row: string[] = [periodLabels[pIdx]]
    days.forEach((_, dIdx) => {
      row.push(content.subjects[(pIdx + dIdx) % content.subjects.length])
    })
    tableRows.push(row)
  })
  const tableH = 60 + periods * 56
  slides.push({
    id: 'slide-week',
    title: '周课程表',
    layout: 'table',
    background: { color: theme.paper },
    elements: [
      elShape('el-week-line', M, 110, 4, 32, 'rect', shapeStyle({ fill: theme.accent })),
      elText('el-week-title', M + 20, 100, CW - 20, 44, `本周课程表（${days[0]}～${days[days.length - 1]}）`, textStyle({
        fontSize: TEXT_SIZES.h2, bold: true, color: theme.accent, align: 'left', valign: 'middle',
      })),
      elTable('el-week-table', M, 170, CW, tableH, tableRows, theme, {
        headerFill: theme.headerFill,
        headerColor: theme.headerColor,
        zebra: true,
      }),
      elText('el-week-note', M, 170 + tableH + 20, CW, 30, '注：具体上课时间以校务公布为准，遇法定节假日顺延。', textStyle({
        fontSize: TEXT_SIZES.small, color: theme.muted, align: 'left', valign: 'middle',
      })),
    ],
  })

  // ========== 5. 各科目特色（图文卡） ==========
  const featureElements: PptElement[] = [
    elShape('el-feat-line', M, 110, 4, 32, 'rect', shapeStyle({ fill: theme.accent })),
    elText('el-feat-title', M + 20, 100, CW - 20, 44, '各科目教学特色', textStyle({
      fontSize: TEXT_SIZES.h2, bold: true, color: theme.accent, align: 'left', valign: 'middle',
    })),
  ]
  const features = [
    { subj: '语文', desc: '注重阅读积累与写作表达，每周开展一次“小小讲故事”。' },
    { subj: '数学', desc: '从生活情境入手，培养逻辑思维与解决实际问题的能力。' },
    { subj: '英语', desc: '情境对话为主，外教每周进校园开展口语互动课。' },
    { subj: '科学', desc: '观察、实验、探究，校园内设有小型科学观察园。' },
    { subj: '音乐', desc: '唱歌、律动、器乐，每学期举办校园音乐会。' },
    { subj: '美术', desc: '色彩与线条训练，学生作品定期在走廊画廊展出。' },
  ]
  features.forEach((f, i) => {
    const cx = M + (i % 2) * (CW / 2 - 20)
    const cy = 170 + Math.floor(i / 2) * 120
    const sc = subjectColor(theme.scheme, f.subj)
    featureElements.push(
      elShape(`el-feat-dot-${i}`, cx, cy + 10, 14, 14, 'ellipse', shapeStyle({ fill: sc })),
      elText(`el-feat-name-${i}`, cx + 26, cy, 200, 34, f.subj, textStyle({
        fontSize: TEXT_SIZES.h3, bold: true, color: sc, align: 'left', valign: 'middle',
      })),
      elText(`el-feat-desc-${i}`, cx + 26, cy + 38, CW / 2 - 60, 70, f.desc, textStyle({
        fontSize: TEXT_SIZES.body, color: theme.ink, align: 'left', valign: 'top', lineHeight: 1.4,
      })),
    )
  })
  slides.push({
    id: 'slide-features',
    title: '各科目特色',
    layout: 'statement',
    background: { color: theme.paper },
    elements: featureElements,
  })

  // ========== 6. 使用须知 ==========
  slides.push({
    id: 'slide-usage',
    title: '使用须知',
    layout: 'statement',
    background: { color: theme.paper },
    elements: [
      elShape('el-use-line', M, 110, 4, 32, 'rect', shapeStyle({ fill: theme.accent })),
      elText('el-use-title', M + 20, 100, CW - 20, 44, '课程表使用须知', textStyle({
        fontSize: TEXT_SIZES.h2, bold: true, color: theme.accent, align: 'left', valign: 'middle',
      })),
      elText('el-use-1', M, 170, CW, 36, '1. 课程表每学期调整一次，调整前会提前一周向家长公示。', textStyle({
        fontSize: TEXT_SIZES.body, color: theme.ink, align: 'left', valign: 'middle', lineHeight: 1.4,
      })),
      elText('el-use-2', M, 214, CW, 36, '2. 如遇公众假期或学校活动，当日课程顺延或合并，以班群通知为准。', textStyle({
        fontSize: TEXT_SIZES.body, color: theme.ink, align: 'left', valign: 'middle', lineHeight: 1.4,
      })),
      elText('el-use-3', M, 258, CW, 36, '3. 课程表电子版已发送至家校沟通群，建议保存至手机相册方便查阅。', textStyle({
        fontSize: TEXT_SIZES.body, color: theme.ink, align: 'left', valign: 'middle', lineHeight: 1.4,
      })),
      elText('el-use-4', M, 302, CW, 36, '4. 如有疑问，请联系班主任或学校教务处。', textStyle({
        fontSize: TEXT_SIZES.body, color: theme.ink, align: 'left', valign: 'middle', lineHeight: 1.4,
      })),
      elText('el-use-5', M, 346, CW, 36, `联系电话：${content.contactPhone || 'XXX-XXXXXXX'}`, textStyle({
        fontSize: TEXT_SIZES.body, color: theme.muted, align: 'left', valign: 'middle',
      })),
    ],
  })

  // ========== 7. 结束页 ==========
  slides.push({
    id: 'slide-end',
    title: '结束页',
    layout: 'end',
    background: { color: theme.paper },
    elements: [
      elShape('el-end-accent', M, 280, 60, 6, 'rect', shapeStyle({ fill: theme.accent })),
      elText('el-end-title', M, 300, CW, 80, '谢谢聆听', textStyle({
        fontSize: TEXT_SIZES.h1, bold: true, color: theme.accent, align: 'center', valign: 'middle',
      })),
      elText('el-end-sub', M, 390, CW, 40, `${content.schoolName} · 课程表`, textStyle({
        fontSize: TEXT_SIZES.h3, color: theme.muted, align: 'center', valign: 'middle',
      })),
      elShape('el-end-line', M + CW / 2 - 30, 450, 60, 4, 'rect', shapeStyle({ fill: theme.accent })),
      elText('el-end-contact', M, 480, CW, 36, `教务处联系电话：${content.contactPhone || 'XXX-XXXXXXX'}`, textStyle({
        fontSize: TEXT_SIZES.body, color: theme.ink, align: 'center', valign: 'middle',
      })),
    ],
  })

  return slides
}
