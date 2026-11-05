/**
 * 演示文稿可视化画布渲染器与交互引擎：
 * - 单页 1280×720 / 960×720 画布渲染（同时复用于缩略图、网格墙与全屏放映）
 * - 单选 / Shift 多选 / 橡皮筋框选
 * - 拖拽移动 + 智能中心/边缘吸附参考线（Snap Guides）
 * - 八向缩放控制点 + 顶部旋转控制柄（Shift 15° 吸附）
 * - 双击文本/形状内联编辑、双击表格单元格内联编辑
 * - 方向键 1px / 10px 微调、格式刷一次性应用
 */

import { renderShapeSvg } from './presets.js'
import { renderChartSvg } from './charts.js'

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SHADOW_CSS = {
  none: 'none',
  soft: '0 6px 20px rgba(15, 23, 42, 0.08)',
  medium: '0 12px 32px rgba(15, 23, 42, 0.15)',
  strong: '0 20px 48px rgba(15, 23, 42, 0.26)',
}

export function slideStageDimensions(scene) {
  return scene?.ratio === '4:3' ? { w: 960, h: 720 } : { w: 1280, h: 720 }
}

export function computeSlideBackgroundCss(scene, slide) {
  const bg = slide?.background || { type: 'theme' }
  const fallback = scene?.theme?.paper || '#FBFAF6'
  let base = bg.color || fallback
  if (bg.type === 'theme') base = fallback
  else if (bg.type === 'gradient' && bg.gradient?.from && bg.gradient?.to) {
    base = `linear-gradient(${Number(bg.gradient.angle ?? 135)}deg, ${bg.gradient.from}, ${bg.gradient.to})`
  } else if (bg.type === 'image' && bg.image) {
    const dim = Number(bg.overlay ?? 0)
    const overlay = dim > 0 ? `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), ` : ''
    base = `${overlay}url("${esc(bg.image)}") center / cover no-repeat`
  }

  let patternCss = ''
  if (bg.pattern === 'dots') {
    const c = scene?.theme?.rule || 'rgba(120,120,128,0.25)'
    patternCss = `radial-gradient(${c} 1.2px, transparent 1.2px)`
  } else if (bg.pattern === 'grid') {
    const c = scene?.theme?.rule || 'rgba(120,120,128,0.18)'
    patternCss = `linear-gradient(to right, ${c} 1px, transparent 1px), linear-gradient(to bottom, ${c} 1px, transparent 1px)`
  }
  return { base, patternCss, patternSize: bg.pattern === 'dots' ? '24px 24px' : bg.pattern === 'grid' ? '40px 40px' : '' }
}

function renderFormattedTextHtml(text, style = {}) {
  const lines = String(text ?? '').split(/\r?\n/)
  if (style.bullet === 'disc' || style.bullet === true) {
    return `<ul class="pe-ul">${lines.filter((l) => l !== '').map((l) => `<li>${esc(l.replace(/^[•\-*]\s*/, ''))}</li>`).join('') || '<li></li>'}</ul>`
  }
  if (style.bullet === 'number') {
    return `<ol class="pe-ol">${lines.filter((l) => l !== '').map((l) => `<li>${esc(l.replace(/^\d+[.)、]\s*/, ''))}</li>`).join('') || '<li></li>'}</ol>`
  }
  return lines.map((l) => (l === '' ? '<br/>' : esc(l))).join('<br/>')
}

export function renderElementInnerHtml(el, scene, interactive = false) {
  const st = el.style || {}
  const font = st.fontFamily || scene?.theme?.fontBody || "ui-sans-serif, system-ui, 'PingFang SC', sans-serif"
  const textDecor = [st.underline ? 'underline' : '', st.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'
  const justifyMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }
  const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'stretch' }

  if (el.type === 'text') {
    const bg = st.fillGradient?.from && st.fillGradient?.to
      ? `linear-gradient(${st.fillGradient.angle ?? 135}deg, ${st.fillGradient.from}, ${st.fillGradient.to})`
      : st.fill || 'transparent'
    const border = st.stroke && (st.strokeWidth || 0) > 0 ? `${st.strokeWidth}px ${st.strokeDash || 'solid'} ${st.stroke}` : 'none'
    const pad = Number(st.padding ?? 8)
    const textStyle = [
      `width:100%`,
      `height:100%`,
      `box-sizing:border-box`,
      `padding:${pad}px`,
      `background:${bg}`,
      `border:${border}`,
      `border-radius:${Number(st.radius ?? 6)}px`,
      `box-shadow:${SHADOW_CSS[st.shadow || 'none'] || 'none'}`,
      `font-family:${font}`,
      `font-size:${Number(st.fontSize ?? 18)}px`,
      `font-weight:${st.bold ? 700 : 400}`,
      `font-style:${st.italic ? 'italic' : 'normal'}`,
      `text-decoration:${textDecor}`,
      `color:${st.color || scene?.theme?.ink || '#141412'}`,
      `line-height:${Number(st.lineHeight ?? 1.38)}`,
      `letter-spacing:${Number(st.letterSpacing ?? 0)}px`,
      `text-align:${st.align || 'left'}`,
      `display:flex`,
      `flex-direction:column`,
      `justify-content:${justifyMap[st.valign || 'top'] || 'flex-start'}`,
      `align-items:${alignMap[st.align || 'left'] || 'flex-start'}`,
      `overflow:hidden`,
      `word-break:break-word`,
    ].join(';')
    const hl = st.highlight && st.highlight !== 'transparent' ? `background-color:${esc(st.highlight)};padding:0 2px;border-radius:3px;` : ''
    return `<div class="pe-txt-box" style="${esc(textStyle)}"><div class="pe-txt-content" style="width:100%;${hl}">${renderFormattedTextHtml(el.text, st)}</div></div>`
  }

  if (el.type === 'shape') {
    const svg = renderShapeSvg(el.shape || 'roundRect', el.w, el.h, st, el.id)
    const pad = Number(st.padding ?? 10)
    const textStyle = [
      `position:absolute`,
      `inset:0`,
      `padding:${pad}px`,
      `display:flex`,
      `flex-direction:column`,
      `justify-content:${justifyMap[st.valign || 'middle'] || 'center'}`,
      `text-align:${st.align || 'center'}`,
      `font-family:${font}`,
      `font-size:${Number(st.fontSize ?? 16)}px`,
      `font-weight:${st.bold ? 700 : 400}`,
      `font-style:${st.italic ? 'italic' : 'normal'}`,
      `text-decoration:${textDecor}`,
      `color:${st.color || '#141412'}`,
      `line-height:${Number(st.lineHeight ?? 1.35)}`,
      `overflow:hidden`,
      `word-break:break-word`,
      `pointer-events:none`,
    ].join(';')
    const filterShadow = st.shadow && st.shadow !== 'none' ? `filter:drop-shadow(0 8px 18px rgba(15,23,42,0.14));` : ''
    return `<div class="pe-shp-box" style="width:100%;height:100%;position:relative;${filterShadow}">${svg}${el.shape !== 'line' ? `<div class="pe-txt-content" style="${esc(textStyle)}">${renderFormattedTextHtml(el.text || '', st)}</div>` : ''}</div>`
  }

  if (el.type === 'image') {
    const radius = el.shape === 'circle' ? '50%' : el.shape === 'pill' ? '999px' : `${Number(st.radius ?? 12)}px`
    const border = st.stroke && (st.strokeWidth || 0) > 0 ? `${st.strokeWidth}px ${st.strokeDash || 'solid'} ${st.stroke}` : 'none'
    const fit = el.objectFit || 'cover'
    const filters = []
    if (el.brightness && el.brightness !== 100) filters.push(`brightness(${el.brightness}%)`)
    if (el.contrast && el.contrast !== 100) filters.push(`contrast(${el.contrast}%)`)
    if (el.grayscale) filters.push(`grayscale(${el.grayscale}%)`)
    const filterCss = filters.length > 0 ? `filter:${filters.join(' ')};` : ''
    return (
      `<div class="pe-img-box" style="width:100%;height:100%;overflow:hidden;border-radius:${radius};border:${esc(border)};box-shadow:${SHADOW_CSS[st.shadow || 'none'] || 'none'};background:${esc(scene?.theme?.card || '#F4F4F2')}">` +
      `<img src="${esc(el.src || '')}" alt="" draggable="false" style="width:100%;height:100%;object-fit:${fit};object-position:${Math.max(0,Math.min(100,Number(el.cropX ?? 50)))}% ${Math.max(0,Math.min(100,Number(el.cropY ?? 50)))}%;transform:scale(${Math.max(1,Math.min(3,Number(el.cropZoom ?? 1)))});display:block;${filterCss}"/>` +
      `</div>`
    )
  }

  if (el.type === 'table') {
    const rows = Array.isArray(el.rows) && el.rows.length > 0 ? el.rows : [['列 1', '列 2'], ['内容', '100']]
    const borderCol = el.borderColor || scene?.theme?.rule || '#E2DED4'
    const headFill = el.headerFill || scene?.theme?.accent || '#1F4FFF'
    const headColor = el.headerColor || '#FFFFFF'
    const bodyFill = st.fill || scene?.theme?.card || '#FFFFFF'
    const bodyColor = st.color || scene?.theme?.ink || '#141412'
    const fs = Number(st.fontSize ?? 15)
    const align = st.align || 'left'

    const trs = rows
      .map((row, rIdx) => {
        const isHead = el.headerRow !== false && rIdx === 0
        const bg = isHead ? headFill : el.zebra && rIdx % 2 === 1 ? 'rgba(128,128,140,0.08)' : bodyFill
        const fg = isHead ? headColor : bodyColor
        const tag = isHead ? 'th' : 'td'
        const cells = row
          .map(
            (cell, cIdx) =>
              `<${tag} data-r="${rIdx}" data-c="${cIdx}" style="border:1px solid ${esc(borderCol)};padding:8px 14px;background:${esc(bg)};color:${esc(fg)};font-weight:${isHead || st.bold ? 600 : 400};text-align:${align};font-size:${fs}px;font-family:${esc(font)}">${esc(cell)}</${tag}>`,
          )
          .join('')
        return `<tr>${cells}</tr>`
      })
      .join('')
    void interactive
    return `<div class="pe-tbl-wrap" style="width:100%;height:100%;overflow:hidden;border-radius:${Number(st.radius ?? 10)}px;box-shadow:${SHADOW_CSS[st.shadow || 'none'] || 'none'}"><table class="pe-tbl" style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed">${trs}</table></div>`
  }

  if (el.type === 'chart') {
    return `<div class="pe-chart-wrap" style="width:100%;height:100%;box-shadow:${SHADOW_CSS[st.shadow || 'none'] || 'none'};border-radius:${Number(st.radius ?? 12)}px">${renderChartSvg(el, scene?.theme)}</div>`
  }

  return ''
}

/**
 * 输出完整单页 HTML（供主画布、缩略图、网格墙和全屏放映复用）
 */
export function renderSlideStageHtml(scene, slide, options = {}) {
  const { w, h } = slideStageDimensions(scene)
  const { base, patternCss, patternSize } = computeSlideBackgroundCss(scene, slide)
  const selectedIds = options.selectedIds || new Set()
  const interactive = options.interactive === true

  const elsHtml = (slide?.elements || [])
    .map((el, idx) => {
      const isSel = interactive && selectedIds.has(el.id)
      const rot = Number(el.rotation || 0)
      const op = Number(el.style?.opacity ?? 1)
      const animAttr = el.animation?.type && el.animation.type !== 'none' ? ` data-anim="${esc(el.animation.type)}" data-anim-trig="${esc(el.animation.trigger || 'onClick')}" data-anim-dur="${Number(el.animation.durationMs || 450)}" data-anim-delay="${Number(el.animation.delayMs || 0)}"` : ''
      const morphAttr = el.morphKey ? ` data-morph="${esc(el.morphKey)}"` : ''
      const badgeAnim =
        interactive && el.animation?.type && el.animation.type !== 'none'
          ? `<span class="pe-anim-tag" title="已绑定动画">✦</span>`
          : ''
      const handles =
        isSel && selectedIds.size === 1
          ? `<span class="pe-rot" data-h="rot" title="拖拽旋转（按住 Shift 按 15° 吸附）"></span>` +
            ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
              .map((dir) => `<span class="pe-hd pe-hd-${dir}" data-h="${dir}"></span>`)
              .join('')
          : ''

      return (
        `<div class="pe-el${isSel ? ' sel' : ''}" data-eid="${esc(el.id)}" data-etype="${esc(el.type)}"${el.hyperlink && /^https?:\/\//i.test(el.hyperlink) ? ` data-link="${esc(el.hyperlink)}"` : ''} data-z="${idx}"${animAttr}${morphAttr} ` +
        `style="position:absolute;left:${Number(el.x).toFixed(1)}px;top:${Number(el.y).toFixed(1)}px;width:${Number(el.w).toFixed(1)}px;height:${Number(el.h).toFixed(1)}px;transform:rotate(${rot}deg);opacity:${op};box-sizing:border-box">` +
        renderElementInnerHtml(el, scene, interactive) +
        badgeAnim +
        handles +
        `</div>`
      )
    })
    .join('')

  const patternLayer = patternCss
    ? `<div class="pe-bg-pattern" style="position:absolute;inset:0;pointer-events:none;background-image:${esc(patternCss)};background-size:${patternSize}"></div>`
    : ''

  return (
    `<div class="pe-stage-inner" data-no-i18n data-sid="${esc(slide?.id || '')}" style="position:relative;width:${w}px;height:${h}px;background:${base};overflow:hidden;user-select:none">` +
    patternLayer +
    elsHtml +
    (interactive ? `<div class="pe-guides" id="peGuides"></div><div class="pe-marquee" id="peMarquee" hidden></div>` : '') +
    `</div>`
  )
}

/**
 * 挂载主画布交互控制器：拖拽、缩放、旋转、吸附参考线、框选、双击内联编辑
 */
export function attachCanvasInteractions(viewportEl, controller) {
  let action = null

  const getStageCoords = (clientX, clientY) => {
    const stageEl = viewportEl.querySelector('.pe-stage-inner')
    if (!stageEl) return { x: 0, y: 0 }
    const rect = stageEl.getBoundingClientRect()
    const scale = controller.getEffectiveScale()
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    }
  }

  const drawGuides = (guides) => {
    const box = viewportEl.querySelector('#peGuides')
    if (!box) return
    if (!guides || guides.length === 0) {
      box.innerHTML = ''
      return
    }
    box.innerHTML = guides
      .map((g) =>
        g.axis === 'x'
          ? `<div class="pe-guide-v" style="left:${g.pos}px"></div>`
          : `<div class="pe-guide-h" style="top:${g.pos}px"></div>`,
      )
      .join('')
  }

  viewportEl.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || !ev.target.closest('.pe-stage-inner')) return
    if (controller.isEditingText()) {
      const editingNode = viewportEl.querySelector('[contenteditable="true"]')
      if (editingNode && editingNode.contains(ev.target)) return
      controller.commitInlineEdit()
    }
    if (ev.target.closest('.pe-float-bar')) return

    const handleEl = ev.target.closest('[data-h]')
    const elDom = ev.target.closest('.pe-el')
    const slide = controller.getCurrentSlide()
    if (!slide) return

    const pt = getStageCoords(ev.clientX, ev.clientY)

    // 1. 缩放或旋转手柄
    if (handleEl && elDom) {
      ev.preventDefault()
      ev.stopPropagation()
      const eid = elDom.dataset.eid
      const target = slide.elements.find((e) => e.id === eid)
      if (!target) return
      const hType = handleEl.dataset.h
      controller.beforeTransform()

      if (hType === 'rot') {
        const cx = target.x + target.w / 2
        const cy = target.y + target.h / 2
        action = {
          mode: 'rotate',
          target,
          cx,
          cy,
          startAngle: Math.atan2(pt.y - cy, pt.x - cx),
          origRot: Number(target.rotation || 0),
          moved: false,
        }
      } else {
        action = {
          mode: 'resize',
          dir: hType,
          target,
          startX: pt.x,
          startY: pt.y,
          orig: { x: target.x, y: target.y, w: target.w, h: target.h },
          moved: false,
        }
      }
      viewportEl.setPointerCapture(ev.pointerId)
      return
    }

    // 2. 点击元素本体：选中 + 准备拖拽（支持格式刷）
    if (elDom) {
      ev.stopPropagation()
      const eid = elDom.dataset.eid
      if (controller.hasFormatBrush()) {
        controller.applyFormatBrushTo(eid)
        return
      }
      controller.selectElement(eid, ev.shiftKey)
      const selected = controller.getSelectedElements()
      if (selected.length === 0) return
      controller.beforeTransform()
      action = {
        mode: 'move',
        startX: pt.x,
        startY: pt.y,
        items: selected.map((el) => ({ el, ox: el.x, oy: el.y })),
        others: slide.elements.filter((el) => !selected.includes(el)),
        moved: false,
      }
      elDom.setPointerCapture(ev.pointerId)
      return
    }

    // 3. 点击画布空白处：取消选中 + 开启橡皮筋框选
    controller.clearSelection()
    action = {
      mode: 'marquee',
      startX: pt.x,
      startY: pt.y,
      moved: false,
    }
    viewportEl.setPointerCapture(ev.pointerId)
  })

  viewportEl.addEventListener('pointermove', (ev) => {
    if (!action) return
    const pt = getStageCoords(ev.clientX, ev.clientY)
    const dx = pt.x - action.startX
    const dy = pt.y - action.startY

    if (action.mode === 'move') {
      if (!action.moved && Math.hypot(dx, dy) < 2.5) return
      action.moved = true

      let snapDx = dx
      let snapDy = dy
      const guides = []

      if (action.items.length === 1 && !ev.altKey) {
        const { el, ox, oy } = action.items[0]
        const { w: stageW, h: stageH } = controller.getStageSize()
        const candX = ox + dx
        const candY = oy + dy
        const SNAP = 6

        const xTargets = [stageW / 2, 76, stageW - 76]
        const yTargets = [stageH / 2, 58, stageH - 58]
        for (const other of action.others) {
          xTargets.push(other.x, other.x + other.w / 2, other.x + other.w)
          yTargets.push(other.y, other.y + other.h / 2, other.y + other.h)
        }

        const myXPoints = [
          { offset: 0, val: candX },
          { offset: el.w / 2, val: candX + el.w / 2 },
          { offset: el.w, val: candX + el.w },
        ]
        for (const mp of myXPoints) {
          const hit = xTargets.find((t) => Math.abs(t - mp.val) <= SNAP)
          if (hit !== undefined) {
            snapDx = hit - mp.offset - ox
            guides.push({ axis: 'x', pos: hit })
            break
          }
        }

        const myYPoints = [
          { offset: 0, val: candY },
          { offset: el.h / 2, val: candY + el.h / 2 },
          { offset: el.h, val: candY + el.h },
        ]
        for (const mp of myYPoints) {
          const hit = yTargets.find((t) => Math.abs(t - mp.val) <= SNAP)
          if (hit !== undefined) {
            snapDy = hit - mp.offset - oy
            guides.push({ axis: 'y', pos: hit })
            break
          }
        }
      }

      for (const item of action.items) {
        item.el.x = Math.round(item.ox + snapDx)
        item.el.y = Math.round(item.oy + snapDy)
        const dom = viewportEl.querySelector(`.pe-el[data-eid="${item.el.id}"]`)
        if (dom) {
          dom.style.left = `${item.el.x}px`
          dom.style.top = `${item.el.y}px`
        }
      }
      drawGuides(guides)
      controller.onLiveGeometryChange()
      return
    }

    if (action.mode === 'resize') {
      action.moved = true
      const { orig, dir, target } = action
      let nx = orig.x
      let ny = orig.y
      let nw = orig.w
      let nh = orig.h
      const minW = 28
      const minH = target.shape === 'line' ? 4 : 24

      if (dir.includes('e')) nw = Math.max(minW, orig.w + dx)
      if (dir.includes('s')) nh = Math.max(minH, orig.h + dy)
      if (dir.includes('w')) {
        const maxDx = orig.w - minW
        const clamped = Math.min(maxDx, dx)
        nx = orig.x + clamped
        nw = orig.w - clamped
      }
      if (dir.includes('n')) {
        const maxDy = orig.h - minH
        const clamped = Math.min(maxDy, dy)
        ny = orig.y + clamped
        nh = orig.h - clamped
      }

      target.x = Math.round(nx)
      target.y = Math.round(ny)
      target.w = Math.round(nw)
      target.h = Math.round(nh)
      controller.paintStageOnly()
      controller.onLiveGeometryChange()
      return
    }

    if (action.mode === 'rotate') {
      action.moved = true
      const curAngle = Math.atan2(pt.y - action.cy, pt.x - action.cx)
      let deg = action.origRot + ((curAngle - action.startAngle) * 180) / Math.PI
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15
      deg = ((Math.round(deg) % 360) + 360) % 360
      action.target.rotation = deg
      const dom = viewportEl.querySelector(`.pe-el[data-eid="${action.target.id}"]`)
      if (dom) dom.style.transform = `rotate(${deg}deg)`
      controller.onLiveGeometryChange()
      return
    }

    if (action.mode === 'marquee') {
      if (Math.hypot(dx, dy) < 4) return
      action.moved = true
      const mq = viewportEl.querySelector('#peMarquee')
      const x = Math.min(action.startX, pt.x)
      const y = Math.min(action.startY, pt.y)
      const w = Math.abs(dx)
      const h = Math.abs(dy)
      action.box = { x, y, w, h }
      if (mq) {
        mq.hidden = false
        mq.style.left = `${x}px`
        mq.style.top = `${y}px`
        mq.style.width = `${w}px`
        mq.style.height = `${h}px`
      }
    }
  })

  const finishPointer = () => {
    if (!action) return
    drawGuides([])
    const mq = viewportEl.querySelector('#peMarquee')
    if (mq) mq.hidden = true

    if (action.mode === 'marquee' && action.moved && action.box) {
      controller.selectInBox(action.box)
    } else if (action.moved && (action.mode === 'move' || action.mode === 'resize' || action.mode === 'rotate')) {
      controller.commitTransform('移动/调整大小')
    } else if (!action.moved && action.mode !== 'marquee') {
      controller.discardTransformSnapshot()
    }
    action = null
  }

  viewportEl.addEventListener('pointerup', finishPointer)
  viewportEl.addEventListener('pointercancel', finishPointer)

  // 双击进入文本 / 形状 / 表格单元格内联编辑
  viewportEl.addEventListener('dblclick', (ev) => {
    const elDom = ev.target.closest('.pe-el')
    if (!elDom) return
    const eid = elDom.dataset.eid
    const cell = ev.target.closest('td[data-r], th[data-r]')
    if (cell) {
      ev.stopPropagation()
      controller.startTableCellEdit(eid, Number(cell.dataset.r), Number(cell.dataset.c), cell)
      return
    }
    ev.stopPropagation()
    controller.startInlineTextEdit(eid, elDom)
  })
}
