import type { ReactNode } from 'react'
import {
  BrushIcon,
  CarouselIcon,
  DocIcon,
  ImageIcon,
  ImportIcon,
  PresentationIcon,
} from './icons'

export interface Capability {
  id: string
  label: string
  icon: ReactNode
  /** Appended to the prompt when the user picks this chip. */
  hint: string
}

/** The row of pills under the composer. */
export const capabilities: Capability[] = [
  { id: 'review', label: '设计评审', icon: <PresentationIcon size={16} />, hint: '从这个方向做一次设计评审：' },
  { id: 'research', label: '用户研究', icon: <DocIcon size={16} />, hint: '帮我梳理目标用户与关键场景：' },
  { id: 'flow', label: '交互流程', icon: <CarouselIcon size={16} />, hint: '把这个需求画成编号流程，并列出所有状态：' },
  { id: 'visual', label: '视觉方案', icon: <ImageIcon size={16} />, hint: '给出可直接实现的视觉规范：' },
  { id: 'polish', label: '界面美化', icon: <BrushIcon size={16} />, hint: '在不改变功能的前提下改进这个界面的视觉层级：' },
  { id: 'import', label: '导入项目', icon: <ImportIcon size={16} />, hint: '先读一遍工作区里的材料，再给我判断：' },
]

export interface Template {
  id: string
  title: string
  /** Template prompt, sent as the first message. */
  prompt: string
  /** Two-stop gradient for the generated thumbnail. */
  palette: [string, string]
  ink: 'light' | 'dark'
  motif: 'stack' | 'type' | 'grid' | 'stamp' | 'circle' | 'lines'
  kicker: string
  meta: string
}

/**
 * Template thumbnails are drawn in CSS, not shipped as images: they stay crisp,
 * weightless, and can be re-themed by changing one palette per card.
 */
export const templates: Template[] = [
  {
    id: 'review',
    title: '界面评审报告',
    kicker: 'REVIEW',
    meta: '评审 · 12 分钟',
    prompt: '先读工作区里的设计说明，然后按致命问题 / 证据缺口 / 实现风险 / 建议动作给出一份评审报告。',
    palette: ['#efe7df', '#d9c6b6'],
    ink: 'dark',
    motif: 'stack',
  },
  {
    id: 'research',
    title: '用户研究提纲',
    kicker: 'RESEARCH',
    meta: '研究 · 8 分钟',
    prompt: '为这个产品写一份用户访谈提纲：目标用户、招募标准、12 个问题、以及如何判断回答是否可信。',
    palette: ['#2b2f36', '#4c525c'],
    ink: 'light',
    motif: 'type',
  },
  {
    id: 'flow',
    title: '关键流程拆解',
    kicker: 'FLOW',
    meta: '交互 · 10 分钟',
    prompt: '把核心任务拆成编号流程，标出用户可能放弃的位置，并给出每个状态（空/加载/失败/无权限）的表现。',
    palette: ['#cfe3d4', '#9dc2a8'],
    ink: 'dark',
    motif: 'grid',
  },
  {
    id: 'brand',
    title: '品牌语气指南',
    kicker: 'VOICE',
    meta: '品牌 · 6 分钟',
    prompt: '基于现有材料提炼品牌语气：三条原则、五个正例、五个反例，以及错误提示应该怎么写。',
    palette: ['#1d1d1f', '#3a3a3f'],
    ink: 'light',
    motif: 'stamp',
  },
  {
    id: 'editorial',
    title: '交付说明书',
    kicker: 'HANDOFF',
    meta: '交付 · 9 分钟',
    prompt: '把当前的界面改动写成交付说明：目标、范围、流程、状态、规格数值、验收清单。',
    palette: ['#f4f1ea', '#ded8c9'],
    ink: 'dark',
    motif: 'lines',
  },
  {
    id: 'pitch',
    title: '方案对比页',
    kicker: 'OPTIONS',
    meta: '决策 · 7 分钟',
    prompt: '给出三个方向并做对比：目标、做法、代价、适用条件，最后明确推荐哪一个并说明理由。',
    palette: ['#ffe066', '#f5b544'],
    ink: 'dark',
    motif: 'circle',
  },
]
