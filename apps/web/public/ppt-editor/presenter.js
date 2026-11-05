/**
 * 路演级全屏放映与演讲者控制台（对标 WPS 放映视图）：
 * - 从头放映 / 从当前页放映 / 演讲者视图（双画面：当前页 + 下一页预览 + 提词备注 + 计时器）
 * - 自动跳过「已隐藏」的幻灯片
 * - 真实页面切换动画：淡出、推入、擦除、缩放、平滑移动 (Morph 元素补间)
 * - 分步元素动画：支持「单击时 (onClick)」「与上一动画同时 (withPrev)」「上一动画之后 (afterPrev)」
 * - 现场控场工具条：激光笔、荧光画笔现场圈画批注（含清屏）、黑屏 (B) / 白屏 (W) 控场
 */

import { renderSlideStageHtml, slideStageDimensions } from './canvas.js'

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function openSlideshow(scene, options = {}) {
  const visibleSlides = scene.slides
    .map((s, originalIndex) => ({ slide: s, originalIndex }))
    .filter((item) => !item.slide.hidden)

  if (visibleSlides.length === 0) return

  let pos = 0
  if (typeof options.startIndex === 'number') {
    const found = visibleSlides.findIndex((it) => it.originalIndex >= options.startIndex)
    if (found >= 0) pos = found
  }

  let speakerMode = options.speaker === true
  let toolMode = 'pointer' // 'pointer' | 'laser' | 'pen'
  let screenMask = 'none' // 'none' | 'black' | 'white'
  let timerSec = 0
  let timerPaused = false

  // 分步动画队列
  let animSteps = []
  let animCursor = 0

  const overlay = document.createElement('div')
  overlay.className = 'pe-show-overlay'
  overlay.tabIndex = -1
  document.body.appendChild(overlay)

  if (!speakerMode && overlay.requestFullscreen) {
    overlay.requestFullscreen().catch(() => {})
  }

  const buildShell = () => {
    overlay.className = 'pe-show-overlay' + (speakerMode ? ' speaker' : '')
    overlay.innerHTML =
      `<div class="pe-show-main">` +
      `<div class="pe-show-stage-wrap" id="peShowStageWrap">` +
      `<div class="pe-show-prev-layer" id="peShowPrevLayer"></div>` +
      `<div class="pe-show-stage-box" id="peShowStageBox"></div>` +
      `<canvas class="pe-show-ink" id="peShowInk"></canvas>` +
      `<div class="pe-show-laser" id="peShowLaser" hidden></div>` +
      `<div class="pe-show-mask" id="peShowMask" hidden></div>` +
      `</div>` +
      `<div class="pe-show-bar">` +
      `<button type="button" data-act="prev" title="上一页 / 上一步">‹</button>` +
      `<span class="pe-show-idx" id="peShowIdx">01 / 01</span>` +
      `<button type="button" data-act="next" title="下一页 / 下一步">›</button>` +
      `<i class="sep"></i>` +
      `<button type="button" data-act="laser" id="peBtnLaser" title="激光笔 (L)">激光笔</button>` +
      `<button type="button" data-act="pen" id="peBtnPen" title="画笔圈画 (P)">画笔</button>` +
      `<button type="button" data-act="clear-ink" title="清除画笔批注 (E)">清屏</button>` +
      `<button type="button" data-act="black" title="黑屏控场 (B)">黑屏</button>` +
      `<button type="button" data-act="speaker" id="peBtnSpeaker" title="切换演讲者提词视图">${speakerMode ? '标准全屏' : '演讲者视图'}</button>` +
      `<button type="button" data-act="exit" class="danger" title="退出放映 (Esc)">退出</button>` +
      `</div>` +
      `</div>` +
      (speakerMode
        ? `<aside class="pe-show-side">` +
          `<div class="pe-sp-timer-card">` +
          `<span class="pe-sp-clock" id="peSpClock">00:00</span>` +
          `<button type="button" id="peSpPause">暂停</button>` +
          `<button type="button" id="peSpReset">归零</button>` +
          `</div>` +
          `<div class="pe-sp-next-head">下一页预览</div>` +
          `<div class="pe-sp-next-box" id="peSpNextBox"></div>` +
          `<div class="pe-sp-notes-head">演讲者备注提词</div>` +
          `<div class="pe-sp-notes" id="peSpNotes"></div>` +
          `</aside>`
        : '')

    wireBar()
    wireInkAndLaser()
    fitShowStage()
  }

  const formatClock = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const timerId = setInterval(() => {
    if (timerPaused) return
    timerSec += 1
    const el = overlay.querySelector('#peSpClock')
    if (el) el.textContent = formatClock(timerSec)
  }, 1000)

  const fitShowStage = () => {
    const wrap = overlay.querySelector('#peShowStageWrap')
    const box = overlay.querySelector('#peShowStageBox')
    const prevLayer = overlay.querySelector('#peShowPrevLayer')
    const ink = overlay.querySelector('#peShowInk')
    if (!wrap || !box) return
    const { w, h } = slideStageDimensions(scene)
    const pad = speakerMode ? 32 : 0
    const availW = Math.max(200, wrap.clientWidth - pad)
    const availH = Math.max(150, wrap.clientHeight - pad)
    const scale = Math.min(availW / w, availH / h)
    const sw = Math.round(w * scale)
    const sh = Math.round(h * scale)

    for (const layer of [box, prevLayer]) {
      if (!layer) continue
      layer.style.width = `${sw}px`
      layer.style.height = `${sh}px`
      const inner = layer.querySelector('.pe-stage-inner')
      if (inner) {
        inner.style.transformOrigin = '0 0'
        inner.style.transform = `scale(${scale})`
      }
    }

    if (ink) {
      ink.width = sw
      ink.height = sh
      ink.style.width = `${sw}px`
      ink.style.height = `${sh}px`
    }

    const nextBox = overlay.querySelector('#peSpNextBox')
    if (nextBox) {
      const nw = nextBox.clientWidth || 260
      const nScale = nw / w
      nextBox.style.height = `${Math.round(h * nScale)}px`
      const nInner = nextBox.querySelector('.pe-stage-inner')
      if (nInner) {
        nInner.style.transformOrigin = '0 0'
        nInner.style.transform = `scale(${nScale})`
      }
    }
  }

  const clearInk = () => {
    const ink = overlay.querySelector('#peShowInk')
    if (!ink) return
    const ctx = ink.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, ink.width, ink.height)
  }

  const prepareAnimations = (stageBox) => {
    animSteps = []
    animCursor = 0
    const nodes = [...stageBox.querySelectorAll('.pe-el[data-anim]')]
    let currentStep = null

    for (const node of nodes) {
      const type = node.dataset.anim
      const trig = node.dataset.animTrig || 'onClick'
      const dur = Number(node.dataset.animDur || 450)
      const delay = Number(node.dataset.animDelay || 0)
      if (!type || type === 'none') continue

      if (type !== 'pulse' && type !== 'fadeOut') {
        node.classList.add('pe-anim-hidden', `pe-anim-init-${type}`)
      }
      const item = { node, type, dur, delay, trig }
      if (trig === 'onClick' || !currentStep) {
        currentStep = [item]
        animSteps.push(currentStep)
      } else {
        currentStep.push(item)
      }
    }
  }

  const runAnimStep = (stepItems) => {
    let accDelay = 0
    for (const it of stepItems) {
      const wait = it.trig === 'afterPrev' ? accDelay + it.delay : it.delay
      setTimeout(() => {
        it.node.style.transition = `opacity ${it.dur}ms cubic-bezier(.22,1,.36,1), transform ${it.dur}ms cubic-bezier(.22,1,.36,1), clip-path ${it.dur}ms ease`
        it.node.classList.remove('pe-anim-hidden', `pe-anim-init-${it.type}`)
        if (it.type === 'pulse') {
          it.node.animate(
            [{ transform: `${it.node.style.transform} scale(1)` }, { transform: `${it.node.style.transform} scale(1.06)` }, { transform: `${it.node.style.transform} scale(1)` }],
            { duration: it.dur },
          )
        } else if (it.type === 'fadeOut') {
          it.node.style.opacity = '0'
        }
      }, wait)
      accDelay += it.dur + it.delay
    }
  }

  const runMorphTransition = (prevInner, nextInner, dur) => {
    if (!prevInner || !nextInner) return
    const prevMap = new Map()
    for (const el of prevInner.querySelectorAll('.pe-el[data-morph]')) {
      const key = el.dataset.morph
      if (key && !prevMap.has(key)) {
        prevMap.set(key, {
          x: parseFloat(el.style.left) || 0,
          y: parseFloat(el.style.top) || 0,
          w: parseFloat(el.style.width) || 100,
          h: parseFloat(el.style.height) || 40,
        })
      }
    }
    for (const el of nextInner.querySelectorAll('.pe-el[data-morph]')) {
      const from = prevMap.get(el.dataset.morph)
      if (!from) continue
      const toX = parseFloat(el.style.left) || 0
      const toY = parseFloat(el.style.top) || 0
      const toW = parseFloat(el.style.width) || 100
      const toH = parseFloat(el.style.height) || 40
      const dx = from.x - toX
      const dy = from.y - toY
      const sx = from.w / Math.max(1, toW)
      const sy = from.h / Math.max(1, toH)
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: '0 0' },
          { transform: 'translate(0, 0) scale(1, 1)', transformOrigin: '0 0' },
        ],
        { duration: dur, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    }
  }

  const renderSlideAt = (nextPos, withTransition = true) => {
    pos = Math.max(0, Math.min(visibleSlides.length - 1, nextPos))
    const entry = visibleSlides[pos]
    const slide = entry.slide
    const box = overlay.querySelector('#peShowStageBox')
    const prevLayer = overlay.querySelector('#peShowPrevLayer')
    if (!box) return

    clearInk()
    const oldHtml = box.innerHTML
    const oldInner = box.querySelector('.pe-stage-inner')

    box.innerHTML = renderSlideStageHtml(scene, slide, { interactive: false })
    prepareAnimations(box)
    fitShowStage()

    // 页面过渡切换效果
    const tr = slide.transition || { type: 'fade', durationMs: 450 }
    const dur = Math.max(180, Number(tr.durationMs || 450))
    if (withTransition && oldHtml && tr.type && tr.type !== 'none') {
      if (tr.type === 'morph' && oldInner) {
        runMorphTransition(oldInner, box.querySelector('.pe-stage-inner'), dur)
      } else {
        if (prevLayer) {
          prevLayer.innerHTML = oldHtml
          fitShowStage()
          setTimeout(() => {
            if (prevLayer) prevLayer.innerHTML = ''
          }, dur + 40)
        }
        const keyframes =
          tr.type === 'push'
            ? [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }]
            : tr.type === 'wipe'
              ? [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }]
              : tr.type === 'zoom'
                ? [{ opacity: 0, transform: 'scale(0.88)' }, { opacity: 1, transform: 'scale(1)' }]
                : [{ opacity: 0 }, { opacity: 1 }]
        box.animate(keyframes, { duration: dur, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
      }
    }

    const idxEl = overlay.querySelector('#peShowIdx')
    if (idxEl) {
      idxEl.textContent = `${String(pos + 1).padStart(2, '0')} / ${String(visibleSlides.length).padStart(2, '0')}`
    }

    if (speakerMode) {
      const nextEntry = visibleSlides[pos + 1]
      const nextBox = overlay.querySelector('#peSpNextBox')
      if (nextBox) {
        nextBox.innerHTML = nextEntry
          ? renderSlideStageHtml(scene, nextEntry.slide, { interactive: false })
          : `<div class="pe-sp-end">已是最后一页</div>`
      }
      const notesEl = overlay.querySelector('#peSpNotes')
      if (notesEl) {
        notesEl.innerHTML = slide.notes?.trim()
          ? esc(slide.notes).replace(/\n/g, '<br/>')
          : `<span class="muted">本页暂无演讲者备注（可在编辑器底部备注栏添加或用 AI 一键生成）。</span>`
      }
      fitShowStage()
    }
  }

  const stepForward = () => {
    if (screenMask !== 'none') {
      setMask('none')
      return
    }
    if (animCursor < animSteps.length) {
      runAnimStep(animSteps[animCursor])
      animCursor += 1
      return
    }
    if (pos < visibleSlides.length - 1) {
      renderSlideAt(pos + 1, true)
    }
  }

  const stepBackward = () => {
    if (screenMask !== 'none') {
      setMask('none')
      return
    }
    if (pos > 0) {
      renderSlideAt(pos - 1, true)
    }
  }

  const setMask = (mode) => {
    screenMask = screenMask === mode ? 'none' : mode
    const maskEl = overlay.querySelector('#peShowMask')
    if (!maskEl) return
    if (screenMask === 'none') {
      maskEl.hidden = true
    } else {
      maskEl.hidden = false
      maskEl.style.background = screenMask === 'white' ? '#FFFFFF' : '#000000'
    }
  }

  const updateToolButtons = () => {
    const laserBtn = overlay.querySelector('#peBtnLaser')
    const penBtn = overlay.querySelector('#peBtnPen')
    const laserDot = overlay.querySelector('#peShowLaser')
    const ink = overlay.querySelector('#peShowInk')
    if (laserBtn) laserBtn.classList.toggle('on', toolMode === 'laser')
    if (penBtn) penBtn.classList.toggle('on', toolMode === 'pen')
    if (laserDot && toolMode !== 'laser') laserDot.hidden = true
    if (ink) ink.style.pointerEvents = toolMode === 'pen' ? 'auto' : 'none'
    overlay.style.cursor = toolMode === 'laser' ? 'none' : toolMode === 'pen' ? 'crosshair' : 'default'
  }

  const wireBar = () => {
    overlay.querySelector('.pe-show-bar')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const btn = ev.target.closest('button[data-act]')
      if (!btn) return
      const act = btn.dataset.act
      if (act === 'prev') stepBackward()
      else if (act === 'next') stepForward()
      else if (act === 'laser') {
        toolMode = toolMode === 'laser' ? 'pointer' : 'laser'
        updateToolButtons()
      } else if (act === 'pen') {
        toolMode = toolMode === 'pen' ? 'pointer' : 'pen'
        updateToolButtons()
      } else if (act === 'clear-ink') clearInk()
      else if (act === 'black') setMask('black')
      else if (act === 'speaker') {
        speakerMode = !speakerMode
        if (!speakerMode && overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {})
        if (speakerMode && document.fullscreenElement) document.exitFullscreen().catch(() => {})
        buildShell()
        renderSlideAt(pos, false)
      } else if (act === 'exit') closeShow()
    })

    overlay.querySelector('#peSpPause')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      timerPaused = !timerPaused
      ev.target.textContent = timerPaused ? '继续' : '暂停'
    })
    overlay.querySelector('#peSpReset')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      timerSec = 0
      const el = overlay.querySelector('#peSpClock')
      if (el) el.textContent = '00:00'
    })
  }

  const wireInkAndLaser = () => {
    const wrap = overlay.querySelector('#peShowStageWrap')
    const ink = overlay.querySelector('#peShowInk')
    const laser = overlay.querySelector('#peShowLaser')
    if (!wrap || !ink) return

    wrap.addEventListener('click', (ev) => {
      const link = ev.target.closest('[data-link]')?.dataset.link
      if (link && /^https?:\/\//i.test(link)) { window.open(link, '_blank', 'noopener,noreferrer'); return }
      if (toolMode === 'pen') return
      if (ev.target.closest('.pe-show-bar')) return
      stepForward()
    })

    wrap.addEventListener('pointermove', (ev) => {
      if (toolMode !== 'laser' || !laser) return
      const r = wrap.getBoundingClientRect()
      laser.hidden = false
      laser.style.left = `${ev.clientX - r.left}px`
      laser.style.top = `${ev.clientY - r.top}px`
    })

    let drawing = false
    ink.addEventListener('pointerdown', (ev) => {
      if (toolMode !== 'pen') return
      ev.stopPropagation()
      drawing = true
      const r = ink.getBoundingClientRect()
      const ctx = ink.getContext('2d')
      ctx.strokeStyle = '#EF4444'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(ev.clientX - r.left, ev.clientY - r.top)
      ink.setPointerCapture(ev.pointerId)
    })
    ink.addEventListener('pointermove', (ev) => {
      if (!drawing) return
      const r = ink.getBoundingClientRect()
      const ctx = ink.getContext('2d')
      ctx.lineTo(ev.clientX - r.left, ev.clientY - r.top)
      ctx.stroke()
    })
    const stopInk = () => {
      drawing = false
    }
    ink.addEventListener('pointerup', stopInk)
    ink.addEventListener('pointercancel', stopInk)
  }

  const onKey = (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault()
      closeShow()
      return
    }
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown' || ev.key === ' ' || ev.key === 'PageDown' || ev.key === 'Enter') {
      ev.preventDefault()
      stepForward()
    } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' || ev.key === 'PageUp' || ev.key === 'Backspace') {
      ev.preventDefault()
      stepBackward()
    } else if (ev.key === 'b' || ev.key === 'B') {
      setMask('black')
    } else if (ev.key === 'w' || ev.key === 'W') {
      setMask('white')
    } else if (ev.key === 'l' || ev.key === 'L') {
      toolMode = toolMode === 'laser' ? 'pointer' : 'laser'
      updateToolButtons()
    } else if (ev.key === 'p' || ev.key === 'P') {
      toolMode = toolMode === 'pen' ? 'pointer' : 'pen'
      updateToolButtons()
    } else if (ev.key === 'e' || ev.key === 'E') {
      clearInk()
    }
  }

  const onResize = () => fitShowStage()

  function closeShow() {
    clearInterval(timerId)
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', onResize)
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    overlay.remove()
    if (typeof options.onExit === 'function') options.onExit(visibleSlides[pos]?.originalIndex ?? 0)
  }

  window.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', onResize)

  buildShell()
  renderSlideAt(pos, false)
  overlay.focus()
}
