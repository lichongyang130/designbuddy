/**
 * DesignBuddy 商业级 PPT 生成器 — 商业主题系统
 *
 * 定义 4 套商业级视觉规范：色系、字体层级、栅格、组件配色。
 * 所有颜色均为 #RRGGBB，可直接被 deck-renderer.ts 消费。
 *
 * @module designbuddy/core/commercial-theme
 */

import type { PptTheme } from './deck-model.ts'

export type ThemeScheme = 'blue' | 'green' | 'orange' | 'multi'

export interface CommercialTheme extends PptTheme {
  scheme: ThemeScheme
  /** 各科目独立配色（方案 multi 使用，其他方案作为强调色辅助） */
  subjectColors: Record<string, string>
  /** 卡片填充色 */
  cardFill: string
  /** 卡片描边色 */
  cardStroke: string
  /** 表头填充色 */
  headerFill: string
  /** 表头文字色 */
  headerColor: string
  /** 斑马纹填充色 */
  zebraFill: string
  /** 辅助块填充色（如学校概况左右色块） */
  blockFill: string
}

const baseFont = { display: 'sans' as const, mono: 'ui-monospace,Menlo,monospace' }

/** 各科目独立色（用于卡片、表格行、图例等） */
const SUBJECT_COLORS: Record<string, string> = {
  语文: '#DC2626',
  数学: '#2563EB',
  英语: '#059669',
  科学: '#7C3AED',
  音乐: '#D97706',
  美术: '#DB2777',
  体育: '#0891B2',
  品社: '#6B7280',
  劳动: '#EA580C',
  阅读: '#4F46E5',
}

export const COMMERCIAL_THEMES: Record<ThemeScheme, CommercialTheme> = {
  blue: {
    scheme: 'blue',
    paper: '#FFFFFF',
    ink: '#17171B',
    accent: '#1F6FEB',
    second: '#0F766E',
    muted: '#6B7280',
    rule: '#E5E7EB',
    font: baseFont,
    subjectColors: SUBJECT_COLORS,
    cardFill: '#F8FAFC',
    cardStroke: '#E2E8F0',
    headerFill: '#1F6FEB',
    headerColor: '#FFFFFF',
    zebraFill: '#F1F5F9',
    blockFill: '#EFF6FF',
  },
  green: {
    scheme: 'green',
    paper: '#FFFFFF',
    ink: '#17171B',
    accent: '#059669',
    second: '#0F766E',
    muted: '#6B7280',
    rule: '#E5E7EB',
    font: baseFont,
    subjectColors: SUBJECT_COLORS,
    cardFill: '#F0FDF4',
    cardStroke: '#BBF7D0',
    headerFill: '#059669',
    headerColor: '#FFFFFF',
    zebraFill: '#ECFDF5',
    blockFill: '#D1FAE5',
  },
  orange: {
    scheme: 'orange',
    paper: '#FFFFFF',
    ink: '#17171B',
    accent: '#F59E0B',
    second: '#0F766E',
    muted: '#6B7280',
    rule: '#E5E7EB',
    font: baseFont,
    subjectColors: SUBJECT_COLORS,
    cardFill: '#FFF7ED',
    cardStroke: '#FDDEB4',
    headerFill: '#F59E0B',
    headerColor: '#FFFFFF',
    zebraFill: '#FFFBEB',
    blockFill: '#FED7AA',
  },
  multi: {
    scheme: 'multi',
    paper: '#FFFFFF',
    ink: '#111827',
    accent: '#111827',
    second: '#0F766E',
    muted: '#6B7280',
    rule: '#E5E7EB',
    font: baseFont,
    subjectColors: SUBJECT_COLORS,
    cardFill: '#F9FAFB',
    cardStroke: '#D1D5DB',
    headerFill: '#111827',
    headerColor: '#FFFFFF',
    zebraFill: '#F3F4F6',
    blockFill: '#E5E7EB',
  },
}

export function getTheme(scheme: ThemeScheme): CommercialTheme {
  return COMMERCIAL_THEMES[scheme] ?? COMMERCIAL_THEMES.blue
}

export function subjectColor(scheme: ThemeScheme, subject: string): string {
  const theme = COMMERCIAL_THEMES[scheme] ?? COMMERCIAL_THEMES.blue
  return theme.subjectColors[subject] ?? theme.accent
}

/** 字体层级（px，逻辑画布 1280×720） */
export const TEXT_SIZES = {
  h1: 44,   // 学校名 / 主标题
  h2: 28,   // 章节标题
  h3: 22,   // 卡片标题 / 科目名
  body: 17, // 正文
  small: 14, // 辅助信息 / 备注
  foot: 12, // 页脚
} as const

/** 画布栅格 */
export const GRID = {
  margin: 88,        // M，左右页边距
  contentWidth: 1280 - 88 * 2, // CW
  slideWidth: 1280,
  slideHeight: 720,
} as const
