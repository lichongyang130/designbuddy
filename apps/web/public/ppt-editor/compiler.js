/**
 * 版式 → 可编辑图层树（SceneGraph）编译器 & 智能无损换版式引擎
 *
 * 统一画布逻辑坐标：
 *   - 16:9 宽屏：1280 × 720
 *   - 4:3  标屏：960  × 720
 */

let _uidSeq = 1
export function uid(prefix = 'el') {
  _uidSeq += 1
  return `${prefix}-${Date.now().toString(36)}-${_uidSeq}`
}

export function isDarkHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

export function deriveCardColor(paper) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(paper || '#FBFAF6').trim())
  if (!m) return '#F4F4F2'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const dark = (r * 299 + g * 587 + b * 114) / 1000 < 128
  const shift = (c) => Math.max(0, Math.min(255, dark ? c + 14 : c - 8))
  return '#' + [shift(r), shift(g), shift(b)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/**
 * 为生成的 `#art:0..5` 绘制与当前配色一致的高质感几何抽象主视觉（SVG Data URL）
 */
export function makeArtDataUrl(artTag, theme = {}) {
  const idx = Number(String(artTag || '0').replace(/\D+/g, '')) % 6
  const bg = theme.card || deriveCardColor(theme.paper)
  const accent = theme.accent || '#1F4FFF'
  const second = theme.second || '#0F766E'
  const rule = theme.rule || '#E2DED4'
  const ink = theme.ink || '#141412'

  let shapes = ''
  if (idx === 0) {
    shapes =
      `<circle cx="380" cy="210" r="150" fill="${accent}" opacity="0.16"/>` +
      `<circle cx="430" cy="270" r="110" fill="${second}" opacity="0.22"/>` +
      `<rect x="80" y="90" width="220" height="280" rx="18" fill="none" stroke="${ink}" stroke-opacity="0.18" stroke-width="2"/>` +
      `<line x1="60" y1="330" x2="500" y2="120" stroke="${accent}" stroke-width="3" opacity="0.65"/>`
  } else if (idx === 1) {
    shapes =
      `<rect x="70" y="70" width="180" height="180" rx="24" fill="${accent}" opacity="0.2"/>` +
      `<rect x="210" y="160" width="220" height="200" rx="24" fill="${second}" opacity="0.18"/>` +
      `<circle cx="390" cy="120" r="56" fill="${accent}" opacity="0.75"/>`
  } else if (idx === 2) {
    shapes = [0, 1, 2, 3, 4]
      .map((i) => `<circle cx="280" cy="220" r="${40 + i * 36}" fill="none" stroke="${i % 2 === 0 ? accent : second}" stroke-width="2.5" opacity="${0.75 - i * 0.12}"/>`)
      .join('')
  } else if (idx === 3) {
    shapes =
      `<polygon points="280,50 480,360 80,360" fill="${accent}" opacity="0.16"/>` +
      `<polygon points="340,110 500,360 180,360" fill="${second}" opacity="0.22"/>` +
      `<circle cx="230" cy="160" r="38" fill="${accent}" opacity="0.8"/>`
  } else if (idx === 4) {
    shapes = [0, 1, 2, 3, 4, 5]
      .map((i) => `<rect x="${70 + i * 72}" y="${290 - i * 34}" width="46" height="${90 + i * 34}" rx="8" fill="${i === 5 ? accent : second}" opacity="${0.22 + i * 0.12}"/>`)
      .join('')
  } else {
    shapes =
      `<path d="M 40 320 Q 180 80, 310 230 T 520 110" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M 40 360 Q 200 160, 340 270 T 520 180" fill="none" stroke="${second}" stroke-width="3" opacity="0.65"/>`
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 440">` +
    `<rect width="560" height="440" fill="${bg}"/>` +
    `<g stroke="${rule}" stroke-width="1" opacity="0.55">` +
    `<line x1="0" y1="110" x2="560" y2="110"/><line x1="0" y1="220" x2="560" y2="220"/><line x1="0" y1="330" x2="560" y2="330"/>` +
    `<line x1="140" y1="0" x2="140" y2="440"/><line x1="280" y1="0" x2="280" y2="440"/><line x1="420" y1="0" x2="420" y2="440"/>` +
    `</g>${shapes}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function resolveSlideImage(deck, imgVal, theme) {
  if (!imgVal) return null
  const s = String(imgVal)
  if (s.startsWith('data:') || s.startsWith('http') || s.startsWith('/')) return s
  if (s.startsWith('#art:')) return makeArtDataUrl(s, theme)
  if (deck && deck.id && !String(deck.id).startsWith('gen-')) {
    const ext = /\.[a-z0-9]+$/i.test(s) ? '' : '.jpg'
    return `cases/${deck.id}/${s}${ext}`
  }
  return makeArtDataUrl(s, theme)
}

export function extractThemeFromDeck(deck = {}) {
  const paper = deck.paper || '#FBFAF6'
  const display = deck.display === 'serif' ? 'serif' : 'sans'
  const serifStack = "Georgia, 'Songti SC', 'Noto Serif SC', serif"
  const sansStack = "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  return {
    name: deck.colorway || '默认主题',
    paper,
    ink: deck.ink || (isDarkHex(paper) ? '#EEF4FF' : '#141412'),
    accent: deck.accent || '#1F4FFF',
    second: deck.second || '#0F766E',
    muted: deck.muted || (isDarkHex(paper) ? '#8598BA' : '#6D6A63'),
    rule: deck.rule || (isDarkHex(paper) ? '#1E2D47' : '#E2DED4'),
    body: deck.body || (isDarkHex(paper) ? '#C6D4EA' : '#33312C'),
    card: deck.card || deriveCardColor(paper),
    display,
    fontHeading: display === 'serif' ? serifStack : sansStack,
    fontBody: sansStack,
  }
}

function mkText(props) {
  return {
    id: uid('txt'),
    type: 'text',
    x: props.x,
    y: props.y,
    w: props.w,
    h: props.h,
    rotation: 0,
    role: props.role || 'body',
    morphKey: props.morphKey || props.role || '',
    text: String(props.text ?? ''),
    animation: props.animation || { type: 'none', trigger: 'onClick', durationMs: 450, delayMs: 0 },
    style: {
      fontFamily: props.fontFamily || '',
      fontSize: props.fontSize ?? 18,
      bold: Boolean(props.bold),
      italic: Boolean(props.italic),
      underline: false,
      strike: false,
      color: props.color || '#141412',
      align: props.align || 'left',
      valign: props.valign || 'top',
      lineHeight: props.lineHeight ?? 1.38,
      letterSpacing: props.letterSpacing ?? 0,
      bullet: props.bullet || false,
      fill: props.fill || 'transparent',
      stroke: props.stroke || '',
      strokeWidth: props.strokeWidth ?? 0,
      radius: props.radius ?? 8,
      padding: props.padding ?? 8,
      opacity: props.opacity ?? 1,
      shadow: props.shadow || 'none',
    },
  }
}

function mkShape(props) {
  return {
    id: uid('shp'),
    type: 'shape',
    shape: props.shape || 'roundRect',
    x: props.x,
    y: props.y,
    w: props.w,
    h: props.h,
    rotation: 0,
    role: props.role || 'card',
    morphKey: props.morphKey || '',
    text: String(props.text ?? ''),
    animation: props.animation || { type: 'none', trigger: 'onClick', durationMs: 450, delayMs: 0 },
    style: {
      fontFamily: props.fontFamily || '',
      fontSize: props.fontSize ?? 16,
      bold: Boolean(props.bold),
      italic: false,
      underline: false,
      strike: false,
      color: props.color || '#141412',
      align: props.align || 'center',
      valign: props.valign || 'middle',
      lineHeight: 1.35,
      fill: props.fill ?? '#F4F4F2',
      fillGradient: props.fillGradient || null,
      stroke: props.stroke || '',
      strokeWidth: props.strokeWidth ?? 0,
      strokeDash: props.strokeDash || 'solid',
      radius: props.radius ?? 14,
      padding: props.padding ?? 10,
      opacity: props.opacity ?? 1,
      shadow: props.shadow || 'none',
    },
  }
}

/**
 * 将单页结构化模板编译为 1280×720（或 960×720）画布上的独立可编辑图层数组
 */
export function compileSlideToElements(deckMeta, s = {}, index = 0, themeInput = null) {
  const theme = themeInput || extractThemeFromDeck(deckMeta)
  const W = deckMeta?.ratio === '4:3' ? 960 : 1280
  const H = 720
  const padX = 76
  const innerW = W - padX * 2
  const k = s.k || 'columns'
  const els = []

  const hFont = theme.fontHeading
  const bFont = theme.fontBody

  const pushHeader = (kicker, title, maxTitleW = innerW) => {
    let topY = 58
    if (kicker) {
      els.push(
        mkText({
          role: 'kicker',
          morphKey: 'slide-kicker',
          x: padX,
          y: 48,
          w: maxTitleW,
          h: 28,
          text: String(kicker).toUpperCase(),
          fontFamily: bFont,
          fontSize: 13,
          bold: true,
          letterSpacing: 1.5,
          color: theme.accent,
          padding: 2,
        }),
      )
      topY = 82
    }
    if (title) {
      els.push(
        mkText({
          role: 'title',
          morphKey: 'slide-title',
          x: padX,
          y: topY,
          w: maxTitleW,
          h: 64,
          text: s.title,
          fontFamily: hFont,
          fontSize: 36,
          bold: true,
          color: theme.ink,
          lineHeight: 1.22,
          padding: 2,
        }),
      )
    }
    els.push(
      mkShape({
        shape: 'line',
        role: 'rule',
        morphKey: 'header-rule',
        x: padX,
        y: topY + 72,
        w: innerW,
        h: 2,
        fill: theme.rule,
        stroke: theme.rule,
        strokeWidth: 1.5,
      }),
    )
    return topY + 96
  }

  const pushFootNote = (noteText) => {
    if (!noteText) return
    els.push(
      mkText({
        role: 'note',
        x: padX,
        y: H - 86,
        w: innerW,
        h: 32,
        text: noteText,
        fontFamily: bFont,
        fontSize: 13,
        color: theme.muted,
        padding: 2,
      }),
    )
  }

  switch (k) {
    case 'cover': {
      const hasImg = Boolean(s.img)
      const leftW = hasImg ? Math.round(innerW * 0.56) : innerW
      if (s.kicker) {
        els.push(
          mkShape({
            shape: 'pill',
            role: 'kicker',
            morphKey: 'slide-kicker',
            x: padX,
            y: 128,
            w: Math.min(340, Math.max(150, String(s.kicker).length * 16 + 36)),
            h: 36,
            text: s.kicker,
            fontFamily: bFont,
            fontSize: 13,
            bold: true,
            fill: theme.card,
            stroke: theme.rule,
            strokeWidth: 1,
            color: theme.accent,
          }),
        )
      }
      els.push(
        mkText({
          role: 'title',
          morphKey: 'slide-title',
          x: padX,
          y: 192,
          w: leftW,
          h: 170,
          text: s.title || deckMeta?.name || '演示文稿标题',
          fontFamily: hFont,
          fontSize: 54,
          bold: true,
          color: theme.ink,
          lineHeight: 1.18,
          padding: 4,
        }),
      )
      els.push(
        mkShape({
          shape: 'roundRect',
          role: 'accent',
          x: padX,
          y: 386,
          w: 72,
          h: 6,
          fill: theme.accent,
          radius: 3,
        }),
      )
      if (s.meta || s.sub) {
        els.push(
          mkText({
            role: 'subtitle',
            x: padX,
            y: 414,
            w: leftW,
            h: 80,
            text: s.meta || s.sub,
            fontFamily: bFont,
            fontSize: 17,
            color: theme.muted,
            lineHeight: 1.5,
            padding: 4,
          }),
        )
      }
      if (hasImg) {
        const src = resolveSlideImage(deckMeta, s.img, theme)
        if (src) {
          els.push({
            id: uid('img'),
            type: 'image',
            role: 'hero-image',
            morphKey: 'slide-hero-img',
            x: padX + leftW + 40,
            y: 108,
            w: innerW - leftW - 40,
            h: 490,
            rotation: 0,
            src,
            artRef: String(s.img).startsWith('#art:') ? String(s.img) : '',
            objectFit: 'cover',
            animation: { type: 'none', trigger: 'onClick', durationMs: 450, delayMs: 0 },
            style: { radius: 18, stroke: theme.rule, strokeWidth: 1, opacity: 1, shadow: 'soft' },
          })
        }
      }
      break
    }

    case 'toc': {
      const startY = pushHeader('CONTENTS', s.title || '目录', innerW)
      const items = Array.isArray(s.items) ? s.items : []
      const cols = items.length > 4 ? 2 : 1
      const colW = cols === 2 ? (innerW - 36) / 2 : innerW
      const perCol = Math.ceil(Math.max(1, items.length) / cols)
      const rowH = Math.min(86, Math.floor((H - startY - 96) / perCol))

      items.forEach((it, idx) => {
        const c = Math.floor(idx / perCol)
        const r = idx % perCol
        const x = padX + c * (colW + 36)
        const y = startY + r * (rowH + 10)
        const no = Array.isArray(it) ? it[0] : String(idx + 1).padStart(2, '0')
        const head = Array.isArray(it) ? it[1] : it?.t || String(it)
        const desc = Array.isArray(it) ? it[2] : it?.d || ''

        els.push(
          mkShape({
            shape: 'roundRect',
            role: 'card',
            x,
            y,
            w: colW,
            h: rowH,
            fill: theme.card,
            stroke: theme.rule,
            strokeWidth: 1,
            radius: 12,
          }),
        )
        els.push(
          mkText({
            role: 'accent-num',
            x: x + 18,
            y: y + (rowH - 36) / 2,
            w: 54,
            h: 36,
            text: String(no),
            fontFamily: bFont,
            fontSize: 22,
            bold: true,
            color: theme.accent,
            valign: 'middle',
          }),
        )
        els.push(
          mkText({
            role: 'item-title',
            x: x + 76,
            y: desc ? y + 12 : y + (rowH - 34) / 2,
            w: colW - 96,
            h: 32,
            text: String(head || ''),
            fontFamily: hFont,
            fontSize: 19,
            bold: true,
            color: theme.ink,
            valign: 'middle',
          }),
        )
        if (desc) {
          els.push(
            mkText({
              role: 'body',
              x: x + 76,
              y: y + 44,
              w: colW - 96,
              h: 28,
              text: String(desc),
              fontFamily: bFont,
              fontSize: 14,
              color: theme.muted,
            }),
          )
        }
      })
      pushFootNote(s.note)
      break
    }

    case 'section': {
      const hasImg = Boolean(s.img)
      const leftW = hasImg ? Math.round(innerW * 0.58) : innerW
      els.push(
        mkText({
          role: 'accent-num',
          morphKey: 'section-num',
          x: padX,
          y: 150,
          w: 220,
          h: 110,
          text: String(s.num || String(index + 1).padStart(2, '0')),
          fontFamily: hFont,
          fontSize: 84,
          bold: true,
          color: theme.accent,
          lineHeight: 1,
        }),
      )
      els.push(
        mkText({
          role: 'title',
          morphKey: 'slide-title',
          x: padX,
          y: 278,
          w: leftW,
          h: 130,
          text: s.title || '章节主题',
          fontFamily: hFont,
          fontSize: 48,
          bold: true,
          color: theme.ink,
          lineHeight: 1.2,
        }),
      )
      if (s.note) {
        els.push(
          mkText({
            role: 'subtitle',
            x: padX,
            y: 424,
            w: leftW,
            h: 54,
            text: s.note,
            fontFamily: bFont,
            fontSize: 17,
            color: theme.muted,
          }),
        )
      }
      if (hasImg) {
        const src = resolveSlideImage(deckMeta, s.img, theme)
        if (src) {
          els.push({
            id: uid('img'),
            type: 'image',
            role: 'hero-image',
            morphKey: 'slide-hero-img',
            x: padX + leftW + 36,
            y: 120,
            w: innerW - leftW - 36,
            h: 460,
            rotation: 0,
            src,
            artRef: String(s.img).startsWith('#art:') ? String(s.img) : '',
            objectFit: 'cover',
            animation: { type: 'none', trigger: 'onClick', durationMs: 450, delayMs: 0 },
            style: { radius: 18, stroke: theme.rule, strokeWidth: 1, opacity: 1 },
          })
        }
      }
      break
    }

    case 'stats': {
      const startY = pushHeader(s.kicker || 'KEY METRICS', s.title || '核心指标')
      const items = Array.isArray(s.items) && s.items.length > 0
        ? s.items
        : [['98.4%', '可用性承诺', '过去 12 个月生产集群实测'], ['3.6x', '吞吐提升', '对比传统静态分配基准'], ['-42%', '单次推理成本', '混合弹性编排实测均值']]
      const count = Math.min(4, items.length)
      const gap = 24
      const cardW = (innerW - gap * (count - 1)) / count
      const cardH = 340

      items.slice(0, count).forEach((it, idx) => {
        const x = padX + idx * (cardW + gap)
        const val = Array.isArray(it) ? it[0] : it?.v || ''
        const name = Array.isArray(it) ? it[1] : it?.t || ''
        const desc = Array.isArray(it) ? it[2] : it?.d || ''

        els.push(
          mkShape({
            shape: 'roundRect',
            role: 'card',
            morphKey: `card-${idx}`,
            x,
            y: startY + 12,
            w: cardW,
            h: cardH,
            fill: theme.card,
            stroke: theme.rule,
            strokeWidth: 1.5,
            radius: 16,
          }),
        )
        els.push(
          mkText({
            role: 'stat-num',
            x: x + 26,
            y: startY + 46,
            w: cardW - 52,
            h: 92,
            text: String(val),
            fontFamily: hFont,
            fontSize: 56,
            bold: true,
            color: idx === 0 ? theme.accent : theme.ink,
            lineHeight: 1.1,
          }),
        )
        els.push(
          mkShape({
            shape: 'line',
            role: 'rule',
            x: x + 26,
            y: startY + 154,
            w: 48,
            h: 3,
            fill: theme.accent,
            stroke: theme.accent,
            strokeWidth: 3,
          }),
        )
        els.push(
          mkText({
            role: 'item-title',
            x: x + 26,
            y: startY + 174,
            w: cardW - 52,
            h: 40,
            text: String(name),
            fontFamily: hFont,
            fontSize: 21,
            bold: true,
            color: theme.ink,
          }),
        )
        els.push(
          mkText({
            role: 'body',
            x: x + 26,
            y: startY + 220,
            w: cardW - 52,
            h: 112,
            text: String(desc),
            fontFamily: bFont,
            fontSize: 15,
            color: theme.body,
            lineHeight: 1.55,
          }),
        )
      })
      pushFootNote(s.note)
      break
    }

    case 'columns': {
      const startY = pushHeader(s.note && s.note.length <= 28 ? s.note : s.kicker || 'KEY POINTS', s.title || '核心要点')
      const cols = Array.isArray(s.cols) && s.cols.length > 0
        ? s.cols
        : [
            { t: '第一项核心能力', d: '双击此处直接编辑正文内容，清晰说明这一模块解决的问题与边界。' },
            { t: '第二项核心能力', d: '支持自由拖拽调整卡片位置，或在顶部工具栏一键更换填充色与圆角。' },
            { t: '第三项核心能力', d: '所有修改实时同步至左侧缩略图，并可导出为原生可编辑 PPTX。' },
          ]
      const count = Math.min(4, cols.length)
      const gap = 24
      const cardW = (innerW - gap * (count - 1)) / count
      const cardH = 360

      cols.slice(0, count).forEach((col, idx) => {
        const x = padX + idx * (cardW + gap)
        els.push(
          mkShape({
            shape: 'roundRect',
            role: 'card',
            morphKey: `card-${idx}`,
            x,
            y: startY + 8,
            w: cardW,
            h: cardH,
            fill: theme.card,
            stroke: theme.rule,
            strokeWidth: 1.5,
            radius: 16,
          }),
        )
        els.push(
          mkShape({
            shape: 'pill',
            role: 'badge',
            x: x + 26,
            y: startY + 34,
            w: 54,
            h: 28,
            text: String(idx + 1).padStart(2, '0'),
            fontFamily: bFont,
            fontSize: 13,
            bold: true,
            fill: idx === 0 ? theme.accent : theme.paper,
            stroke: idx === 0 ? theme.accent : theme.rule,
            strokeWidth: 1,
            color: idx === 0 ? '#FFFFFF' : theme.accent,
          }),
        )
        els.push(
          mkText({
            role: 'item-title',
            x: x + 26,
            y: startY + 82,
            w: cardW - 52,
            h: 52,
            text: String(col.t || `要点 ${idx + 1}`),
            fontFamily: hFont,
            fontSize: 22,
            bold: true,
            color: theme.ink,
            lineHeight: 1.28,
          }),
        )
        els.push(
          mkText({
            role: 'body',
            x: x + 26,
            y: startY + 146,
            w: cardW - 52,
            h: 196,
            text: String(col.d || ''),
            fontFamily: bFont,
            fontSize: 16,
            color: theme.body,
            lineHeight: 1.6,
          }),
        )
      })
      if (s.note && s.note.length > 28) pushFootNote(s.note)
      break
    }

    case 'bars': {
      const startY = pushHeader(s.kicker || 'DATA COMPARISON', s.title || '关键数据对比')
      const items = Array.isArray(s.items) && s.items.length > 0
        ? s.items
        : [['传统人工排期', 22], ['半自动模板', 14], ['上一代工具', 9], ['本方案', 3]]
      const categories = items.map((it) => String(Array.isArray(it) ? it[0] : it?.name || ''))
      const values = items.map((it) => Number(Array.isArray(it) ? it[1] : it?.value || 0))
      els.push({
        id: uid('cht'),
        type: 'chart',
        chartType: 'bar',
        chartTitle: '',
        role: 'chart',
        morphKey: 'slide-chart',
        x: padX,
        y: startY + 6,
        w: innerW,
        h: 368,
        rotation: 0,
        categories,
        series: [{ name: s.title || '指标', values, color: theme.accent }],
        unit: s.unit || '',
        max: s.max || undefined,
        showValues: true,
        showLegend: false,
        showGrid: true,
        animation: { type: 'none', trigger: 'onClick', durationMs: 450, delayMs: 0 },
        style: {
          fill: theme.card,
          stroke: theme.rule,
          strokeWidth: 1.5,
          radius: 16,
          color: theme.ink,
          opacity: 1,
        },
      })
      pushFootNote(s.note)
      break
    }

    case 'steps': {
      const startY = pushHeader(s.kicker || 'PROCESS & ARCHITECTURE', s.title || '核心流程与步骤')
      const items = Array.isArray(s.items) && s.items.length > 0
        ? s.items
        : [
            { n: '01', t: '接入与采集', d: '多源异构数据自动清洗与标准化结构抽取。' },
            { n: '02', t: '语义理解', d: '精准识别业务场景、目标受众与关键约束。' },
            { n: '03', t: '协同编排', d: '内容逻辑与视觉版式同步计算生成。' },
            { n: '04', t: '闭环交付', d: '质量校验通过后直接导出本地可编辑文档。' },
          ]
      const count = Math.min(5, items.length)
      const gap = 20
      const stepW = (innerW - gap * (count - 1)) / count

      items.slice(0, count).forEach((it, idx) => {
        const x = padX + idx * (stepW + gap)
        const num = it.n || String(idx + 1).padStart(2, '0')
        els.push(
          mkShape({
            shape: 'roundRect',
            role: 'card',
            morphKey: `card-${idx}`,
            x,
            y: startY + 14,
            w: stepW,
            h: 350,
            fill: theme.card,
            stroke: idx === count - 1 ? theme.accent : theme.rule,
            strokeWidth: idx === count - 1 ? 2 : 1.5,
            radius: 16,
          }),
        )
        els.push(
          mkText({
            role: 'accent-num',
            x: x + 22,
            y: startY + 38,
            w: stepW - 44,
            h: 56,
            text: String(num),
            fontFamily: hFont,
            fontSize: 40,
            bold: true,
            color: theme.accent,
          }),
        )
        els.push(
          mkText({
            role: 'item-title',
            x: x + 22,
            y: startY + 112,
            w: stepW - 44,
            h: 48,
            text: String(it.t || ''),
            fontFamily: hFont,
            fontSize: 20,
            bold: true,
            color: theme.ink,
          }),
        )
        els.push(
          mkText({
            role: 'body',
            x: x + 22,
            y: startY + 168,
            w: stepW - 44,
            h: 174,
            text: String(it.d || ''),
            fontFamily: bFont,
            fontSize: 15,
            color: theme.body,
            lineHeight: 1.58,
          }),
        )
      })
      pushFootNote(s.note)
      break
    }

    case 'timeline': {
      const startY = pushHeader(s.kicker || 'ROADMAP', s.title || '关键里程碑规划')
      const items = Array.isArray(s.items) && s.items.length > 0
        ? s.items
        : [
            ['2027 Q1', '底座上线', '核心引擎与高频模板覆盖率达 90%'],
            ['2027 Q2', '团队协同', '支持多角色实时批注与版本回溯'],
            ['2027 Q3', '生态连接', '打通主流企业数据源与知识库'],
            ['2027 Q4', '规模商业化', '重点行业专属预设与私有化交付'],
          ]
      const count = Math.min(5, items.length)
      const lineY = startY + 88
      els.push(
        mkShape({
          shape: 'line',
          role: 'rule',
          x: padX + 20,
          y: lineY,
          w: innerW - 40,
          h: 3,
          fill: theme.accent,
          stroke: theme.accent,
          strokeWidth: 3,
        }),
      )
      const colW = innerW / count
      items.slice(0, count).forEach((it, idx) => {
        const x = padX + idx * colW
        const time = Array.isArray(it) ? it[0] : it?.time || `阶段 ${idx + 1}`
        const head = Array.isArray(it) ? it[1] : it?.t || ''
        const desc = Array.isArray(it) ? it[2] : it?.d || ''

        els.push(
          mkText({
            role: 'kicker',
            x: x + 8,
            y: startY + 34,
            w: colW - 16,
            h: 32,
            text: String(time),
            fontFamily: bFont,
            fontSize: 15,
            bold: true,
            color: theme.accent,
          }),
        )
        els.push(
          mkShape({
            shape: 'ellipse',
            role: 'badge',
            x: x + 14,
            y: lineY - 10,
            w: 22,
            h: 22,
            fill: theme.accent,
            stroke: theme.paper,
            strokeWidth: 4,
          }),
        )
        els.push(
          mkShape({
            shape: 'roundRect',
            role: 'card',
            x: x + 6,
            y: lineY + 32,
            w: colW - 18,
            h: 230,
            fill: theme.card,
            stroke: theme.rule,
            strokeWidth: 1.5,
            radius: 14,
          }),
        )
        els.push(
          mkText({
            role: 'item-title',
            x: x + 24,
            y: lineY + 54,
            w: colW - 54,
            h: 42,
            text: String(head),
            fontFamily: hFont,
            fontSize: 20,
            bold: true,
            color: theme.ink,
          }),
        )
        els.push(
          mkText({
            role: 'body',
            x: x + 24,
            y: lineY + 104,
            w: colW - 54,
            h: 140,
            text: String(desc),
            fontFamily: bFont,
            fontSize: 15,
            color: theme.body,
            lineHeight: 1.55,
          }),
        )
      })
      pushFootNote(s.note)
      break
    }

    case 'table':
    case 'ledger': {
      const startY = pushHeader(s.kicker || 'STRUCTURED DATA', s.title || '结构化数据明细')
      const head = Array.isArray(s.head) ? s.head.map(String) : ['维度', '当前方案', '量化收益']
      const bodyRows = Array.isArray(s.rows)
        ? s.rows.map((r) => (Array.isArray(r) ? r.map(String) : [String(r)]))
        : [
            ['方案准备', '全流程在线编辑', '效率提升 4 倍'],
            ['格式规范', '全局设计变量统一管控', '零返工'],
            ['文件交付', '一键导出原生 PPTX / PDF', '100% 兼容'],
          ]
      els.push({
        id: uid('tbl'),
        type: 'table',
        role: 'table',
        morphKey: 'slide-table',
        x: padX,
        y: startY + 10,
        w: innerW,
        h: Math.min(370, Math.max(210, (bodyRows.length + 1) * 66)),
        rotation: 0,
        headerRow: true,
        zebra: true,
        headerFill: theme.accent,
        headerColor: '#FFFFFF',
        borderColor: theme.rule,
        rows: [head, ...bodyRows],
        animation: { type: 'none', trigger: 'onClick', durationMs: 450, delayMs: 0 },
        style: {
          fontFamily: bFont,
          fontSize: 16,
          color: theme.ink,
          fill: theme.card,
          align: 'left',
          opacity: 1,
        },
      })
      pushFootNote(s.note)
      break
    }

    case 'metric': {
      if (s.kicker) {
        els.push(
          mkText({
            role: 'kicker',
            x: padX,
            y: 92,
            w: innerW,
            h: 32,
            text: s.kicker,
            fontFamily: bFont,
            fontSize: 14,
            bold: true,
            letterSpacing: 1.5,
            color: theme.accent,
          }),
        )
      }
      els.push(
        mkShape({
          shape: 'roundRect',
          role: 'card',
          x: padX,
          y: 144,
          w: innerW,
          h: 410,
          fill: theme.card,
          stroke: theme.rule,
          strokeWidth: 1.5,
          radius: 24,
        }),
      )
      els.push(
        mkText({
          role: 'stat-num',
          morphKey: 'big-metric',
          x: padX + 48,
          y: 192,
          w: innerW - 96,
          h: 160,
          text: String(s.big || '64%'),
          fontFamily: hFont,
          fontSize: 118,
          bold: true,
          color: theme.accent,
          align: 'center',
          valign: 'middle',
          lineHeight: 1,
        }),
      )
      els.push(
        mkText({
          role: 'title',
          morphKey: 'slide-title',
          x: padX + 80,
          y: 368,
          w: innerW - 160,
          h: 64,
          text: String(s.label || s.title || '关键核心成效指标'),
          fontFamily: hFont,
          fontSize: 28,
          bold: true,
          color: theme.ink,
          align: 'center',
        }),
      )
      if (s.note) {
        els.push(
          mkText({
            role: 'note',
            x: padX + 80,
            y: 454,
            w: innerW - 160,
            h: 44,
            text: s.note,
            fontFamily: bFont,
            fontSize: 15,
            color: theme.muted,
            align: 'center',
          }),
        )
      }
      break
    }

    case 'statement':
    case 'quote': {
      const isQuote = k === 'quote'
      els.push(
        mkShape({
          shape: 'roundRect',
          role: 'accent',
          x: padX,
          y: 180,
          w: 8,
          h: 260,
          fill: theme.accent,
          radius: 4,
        }),
      )
      els.push(
        mkText({
          role: 'title',
          morphKey: 'slide-title',
          x: padX + 40,
          y: 176,
          w: innerW - 60,
          h: 270,
          text: isQuote ? `“${String(s.text || s.title || '').replace(/^[“"]|[”"]$/g, '')}”` : String(s.text || s.title || '核心命题与关键判断'),
          fontFamily: hFont,
          fontSize: 38,
          bold: true,
          italic: isQuote,
          color: theme.ink,
          lineHeight: 1.42,
          valign: 'middle',
        }),
      )
      if (s.by || s.foot || s.note) {
        els.push(
          mkText({
            role: 'subtitle',
            x: padX + 40,
            y: 472,
            w: innerW - 60,
            h: 48,
            text: `—— ${s.by || s.foot || s.note}`,
            fontFamily: bFont,
            fontSize: 17,
            color: theme.muted,
          }),
        )
      }
      break
    }

    case 'split': {
      const imgW = Math.round(innerW * 0.44)
      const src = resolveSlideImage(deckMeta, s.img || '#art:1', theme)
      if (src) {
        els.push({
          id: uid('img'),
          type: 'image',
          role: 'hero-image',
          morphKey: 'slide-hero-img',
          x: padX,
          y: 88,
          w: imgW,
          h: 530,
          rotation: 0,
          src,
          artRef: String(s.img || '#art:1').startsWith('#art:') ? String(s.img || '#art:1') : '',
          objectFit: 'cover',
          animation: { type: 'none', trigger: 'onClick', durationMs: 450, delayMs: 0 },
          style: { radius: 18, stroke: theme.rule, strokeWidth: 1, opacity: 1 },
        })
      }
      const rx = padX + imgW + 44
      const rw = innerW - imgW - 44
      els.push(
        mkText({
          role: 'title',
          morphKey: 'slide-title',
          x: rx,
          y: 96,
          w: rw,
          h: 108,
          text: s.title || '图文分栏核心解析',
          fontFamily: hFont,
          fontSize: 34,
          bold: true,
          color: theme.ink,
          lineHeight: 1.25,
        }),
      )
      const paras = Array.isArray(s.paras) ? s.paras.join('\n\n') : (s.text || '左侧展示核心架构图或实景配图，右侧拆解对应的关键设计决策与落地要点。')
      els.push(
        mkText({
          role: 'body',
          x: rx,
          y: 220,
          w: rw,
          h: 180,
          text: paras,
          fontFamily: bFont,
          fontSize: 16,
          color: theme.body,
          lineHeight: 1.65,
        }),
      )
      const bullets = Array.isArray(s.bullets) ? s.bullets : ['支持替换任意本地高清图片', '圆角与裁剪蒙版自由可调', '图文比例符合黄金阅读节奏']
      els.push(
        mkText({
          role: 'body',
          x: rx,
          y: 416,
          w: rw,
          h: 180,
          text: bullets.join('\n'),
          fontFamily: bFont,
          fontSize: 15,
          bold: true,
          color: theme.ink,
          bullet: 'disc',
          lineHeight: 1.75,
          fill: theme.card,
          radius: 12,
          padding: 16,
        }),
      )
      break
    }

    case 'compare': {
      const startY = pushHeader(s.kicker || 'COMPARISON', s.title || '方案横向对比')
      const left = s.left || { h: '传统做法', rows: [['耗时周期', '2–4 周'], ['协作成本', '反复人工对齐'], ['可维护性', '改一处动全身']] }
      const right = s.right || { h: '本方案', rows: [['耗时周期', '分钟级生成'], ['协作成本', '大纲确认即交付'], ['可维护性', '主题样式全局联动']] }
      const colW = (innerW - 28) / 2
      ;[left, right].forEach((side, idx) => {
        const x = padX + idx * (colW + 28)
        const isRight = idx === 1
        els.push(
          mkShape({
            shape: 'roundRect',
            role: 'card',
            x,
            y: startY + 10,
            w: colW,
            h: 360,
            fill: theme.card,
            stroke: isRight ? theme.accent : theme.rule,
            strokeWidth: isRight ? 2 : 1.5,
            radius: 16,
          }),
        )
        els.push(
          mkText({
            role: 'item-title',
            x: x + 28,
            y: startY + 34,
            w: colW - 56,
            h: 40,
            text: String(side.h || (isRight ? '升级方案' : '传统方案')),
            fontFamily: hFont,
            fontSize: 23,
            bold: true,
            color: isRight ? theme.accent : theme.muted,
          }),
        )
        const lines = Array.isArray(side.rows)
          ? side.rows.map((r) => (Array.isArray(r) ? `${r[0]}：${r[1]}` : String(r))).join('\n')
          : ''
        els.push(
          mkText({
            role: 'body',
            x: x + 28,
            y: startY + 94,
            w: colW - 56,
            h: 248,
            text: lines,
            fontFamily: bFont,
            fontSize: 17,
            color: theme.ink,
            bullet: 'disc',
            lineHeight: 1.85,
          }),
        )
      })
      pushFootNote(s.note)
      break
    }

    case 'fullimg':
    case 'figure': {
      const src = resolveSlideImage(deckMeta, s.img || '#art:2', theme)
      if (src) {
        els.push({
          id: uid('img'),
          type: 'image',
          role: 'hero-image',
          x: padX,
          y: 64,
          w: innerW,
          h: 520,
          rotation: 0,
          src,
          artRef: String(s.img || '#art:2').startsWith('#art:') ? String(s.img || '#art:2') : '',
          objectFit: 'cover',
          animation: { type: 'none', trigger: 'onClick', durationMs: 450, delayMs: 0 },
          style: { radius: 16, stroke: theme.rule, strokeWidth: 1, opacity: 1 },
        })
      }
      if (s.cap || s.title) {
        els.push(
          mkText({
            role: 'subtitle',
            x: padX,
            y: 600,
            w: innerW,
            h: 44,
            text: String(s.cap || s.title),
            fontFamily: bFont,
            fontSize: 16,
            color: theme.muted,
          }),
        )
      }
      break
    }

    case 'end': {
      els.push(
        mkShape({
          shape: 'roundRect',
          role: 'badge',
          x: (W - 88) / 2,
          y: 164,
          w: 88,
          h: 88,
          text: String(s.mark || (deckMeta?.name || 'D').slice(0, 1).toUpperCase()),
          fontFamily: hFont,
          fontSize: 38,
          bold: true,
          fill: theme.accent,
          color: '#FFFFFF',
          radius: 22,
        }),
      )
      els.push(
        mkText({
          role: 'title',
          morphKey: 'slide-title',
          x: padX + 80,
          y: 282,
          w: innerW - 160,
          h: 96,
          text: s.title || '感谢聆听 · 欢迎交流',
          fontFamily: hFont,
          fontSize: 48,
          bold: true,
          color: theme.ink,
          align: 'center',
          valign: 'middle',
        }),
      )
      els.push(
        mkShape({
          shape: 'line',
          role: 'rule',
          x: (W - 160) / 2,
          y: 400,
          w: 160,
          h: 2,
          fill: theme.rule,
          stroke: theme.rule,
          strokeWidth: 2,
        }),
      )
      const lines = Array.isArray(s.lines) ? s.lines.join('  ·  ') : (s.note || '')
      if (lines) {
        els.push(
          mkText({
            role: 'subtitle',
            x: padX + 80,
            y: 426,
            w: innerW - 160,
            h: 64,
            text: lines,
            fontFamily: bFont,
            fontSize: 17,
            color: theme.muted,
            align: 'center',
          }),
        )
      }
      break
    }

    case 'blank':
      break

    default: {
      const startY = pushHeader(s.kicker || '', s.title || s.label || '幻灯片内容')
      const textBody = s.text || (Array.isArray(s.paras) ? s.paras.join('\n\n') : '') || s.cap || s.note || '双击此处输入页面正文内容。'
      els.push(
        mkText({
          role: 'body',
          x: padX,
          y: startY + 12,
          w: innerW,
          h: 360,
          text: String(textBody),
          fontFamily: bFont,
          fontSize: 20,
          color: theme.body,
          lineHeight: 1.6,
        }),
      )
      break
    }
  }

  // 页脚刊头与页码（folio）
  if (deckMeta?.folio !== false && k !== 'blank') {
    els.push(
      mkText({
        role: 'folio-left',
        x: padX,
        y: H - 44,
        w: 480,
        h: 24,
        text: String(deckMeta?.footLeft || deckMeta?.name || ''),
        fontFamily: bFont,
        fontSize: 11,
        color: theme.muted,
        padding: 0,
      }),
    )
    els.push(
      mkText({
        role: 'folio-num',
        x: W - padX - 80,
        y: H - 44,
        w: 80,
        h: 24,
        text: String(index + 1).padStart(2, '0'),
        fontFamily: bFont,
        fontSize: 11,
        bold: true,
        color: theme.muted,
        align: 'right',
        padding: 0,
      }),
    )
  }

  return els
}

/**
 * 整套 GeneratedDeck / CASE_DECK → 可编辑场景图（EditableDeck）
 */
export function compileDeckToScene(deck) {
  const theme = extractThemeFromDeck(deck)
  const ratio = deck?.ratio === '4:3' ? '4:3' : '16:9'
  const rawSlides = Array.isArray(deck?.slides) ? deck.slides : []

  const slides = Array.from(rawSlides, (raw, idx) => {
    const s = raw || { k: 'blank', label: `第 ${idx + 1} 页` }
    return ({
    id: uid('sld'),
    label: s?.label || s?.title || `第 ${idx + 1} 页`,
    layoutKind: s?.k || 'columns',
    hidden: false,
    notes: s?.notes || '',
    background: {
      type: 'theme',
      color: theme.paper,
      gradient: null,
      image: '',
      pattern: 'none',
    },
    transition: {
      type: 'fade',
      durationMs: 450,
    },
    raw: JSON.parse(JSON.stringify(s || {})),
    elements: compileSlideToElements({ ...deck, ratio }, s, idx, theme),
    })
  })

  return {
    id: deck?.id || uid('deck'),
    title: deck?.name || '未命名演示文稿',
    ratio,
    folio: deck?.folio !== false,
    footLeft: deck?.footLeft || deck?.name || '',
    theme,
    slides,
  }
}

/**
 * 按指定版式新建一页幻灯片
 */
export function createSlideFromLayout(layoutKind, scene, insertIndex) {
  const theme = scene.theme
  const titleBase = scene.title || '核心业务'
  const meta = { name: titleBase, ratio: scene.ratio, folio: scene.folio, footLeft: scene.footLeft }
  const seedSlides = {
    cover: { k: 'cover', label: '封面', kicker: 'PRESENTATION · 2026', title: titleBase, meta: '双击修改副标题、演讲人或汇报日期', img: '#art:0' },
    toc: { k: 'toc', label: '目录', title: '汇报目录', items: [['01', '项目背景与痛点', '现状复盘与关键机会'], ['02', '核心方案架构', '技术路线与关键突破'], ['03', '落地数据验证', '量化成效与标杆案例'], ['04', '下一阶段规划', '里程碑与资源需求']] },
    section: { k: 'section', label: '章节过渡', num: String(insertIndex + 1).padStart(2, '0'), title: '新章节核心议题', note: '承上启下 · 明确本节核心问题', img: '#art:2' },
    columns: { k: 'columns', label: '三栏要点', kicker: 'KEY PILLARS', title: '三大核心支撑能力', cols: [{ t: '核心能力一', d: '在此补充具体方法论、实施动作与关键边界条件。' }, { t: '核心能力二', d: '在此补充可量化的优势对比或底层架构机制。' }, { t: '核心能力三', d: '在此补充团队沉淀与可持续复用的长期价值。' }] },
    stats: { k: 'stats', label: '关键指标', title: '用三个关键数字说话', items: [['99.2%', '交付达标率', '连续四个季度稳定运行'], ['3.8x', '人效提升倍数', '全链路自动化改造后实测'], ['45%', '综合成本下降', '单位算力与运维投入同口径对比']], note: '数据口径：2026 年度内部经营统计报告' },
    bars: { k: 'bars', label: '数据图表', title: '各阶段关键指标增长趋势', items: [['Q1 启动期', 28], ['Q2 验证期', 52], ['Q3 推广期', 86], ['Q4 规模化', 135]], note: '选中图表可在右侧面板直接修改数据表或切换柱形/折线/饼图' },
    steps: { k: 'steps', label: '四步流程', kicker: 'WORKFLOW', title: '标准化四步闭环流程', items: [{ n: '01', t: '需求对齐', d: '明确业务目标与核心验收指标。' }, { n: '02', t: '方案设计', d: '输出架构蓝图与关键路径拆解。' }, { n: '03', t: '敏捷交付', d: '小步快跑验证核心场景闭环。' }, { n: '04', t: '复盘沉淀', d: '固化标准模板并持续迭代优化。' }] },
    timeline: { k: 'timeline', label: '时间轴', title: '年度路线图与关键节点', items: [['2026 Q4', 'V1 核心版', '跑通端到端主流程'], ['2027 Q1', 'V2 协同版', '支持多角色在线精修与导出'], ['2027 Q2', 'V3 生态版', '开放插件与行业连接器'], ['2027 Q3', '规模交付', '覆盖百家核心标杆客户']] },
    compare: { k: 'compare', label: '左右对比', title: '改造前后核心体验对比', left: { h: '改造前（传统模式）', rows: [['制作耗时', '平均 3–5 天反复排版'], ['视觉一致性', '多处色值字号混乱'], ['文件交付', '截图拼凑难以二次编辑']] }, right: { h: '改造后（新工作台）', rows: [['制作耗时', '30 分钟成稿即精修'], ['视觉一致性', '全局主题色一键统管'], ['文件交付', '直出标准可编辑 PPTX']] } },
    table: { k: 'table', label: '数据表格', title: '资源配置与预算拆分表', head: ['模块名称', '负责团队', '周期', '预算占比'], rows: [['核心引擎研发', '平台架构组', '8 周', '45%'], ['可视化编辑器', '前端体验组', '6 周', '30%'], ['文档兼容与导出', '办公套件组', '4 周', '25%']], note: '双击任意单元格即可直接修改表格文字' },
    split: { k: 'split', label: '左图右文', title: '架构设计与现场实测解析', img: '#art:3', paras: ['通过将底层结构化生成与上层自由画布解耦，既保留了一句话成稿的速度，又提供了像素级的样式控制力。'], bullets: ['双击任意文字直接内联编辑', '拖拽控制柄自由缩放与旋转', '支持智能对齐吸附参考线'] },
    metric: { k: 'metric', label: '大数冲击', kicker: 'CORE IMPACT', big: '10x', note: '从想法大纲到路演级可编辑演示文稿的整体效率跃迁' },
    statement: { k: 'statement', label: '核心金句', text: '把 80% 的机械排版交给自动化，把 100% 的审美与决策权还给创作者。', foot: titleBase + ' · 核心设计原则' },
    quote: { k: 'quote', label: '客户证言', text: '生成完不用推倒重来，直接在画布上调字号、加图表、导出 PPTX 就能上会，真正解决了最后一公里。', by: '企业级早期采用团队反馈' },
    end: { k: 'end', label: '封底致谢', title: '感谢聆听 · 期待合作', lines: [titleBase, '欢迎提问与深入交流'], mark: titleBase.slice(0, 1).toUpperCase() },
    blank: { k: 'blank', label: '空白画布' },
  }

  const raw = seedSlides[layoutKind] || seedSlides.columns
  return {
    id: uid('sld'),
    label: raw.label,
    layoutKind,
    hidden: false,
    notes: '',
    background: { type: 'theme', color: theme.paper, gradient: null, image: '', pattern: 'none' },
    transition: { type: 'fade', durationMs: 450 },
    raw,
    elements: compileSlideToElements(meta, raw, insertIndex, theme),
  }
}

/**
 * 单页智能无损换版式：从当前页图层中提取已有文案（不丢用户写过的标题和要点），重排为目标版式
 */
export function switchSlideLayout(slide, targetKind, scene, slideIndex) {
  // Assign matching template slots to existing elements, never replace their content.
  // Unmatched elements remain where they were, including user-added artwork and tables.
  const template = createSlideFromLayout(targetKind, scene, slideIndex)
  const available = [...template.elements]
  for (const el of slide.elements) {
    if (!el.role) continue
    const slotIndex = available.findIndex(slot => slot.role === el.role && slot.type === el.type)
    if (slotIndex < 0) continue
    const slot = available.splice(slotIndex, 1)[0]
    Object.assign(el, {x:slot.x, y:slot.y, w:slot.w, h:slot.h})
  }
  slide.layoutKind = targetKind
}

/**
 * 全局或单页换主题配色：智能映射旧主题色值到新主题，保留用户自定义的特殊强调色
 */
export function applyThemeToSlides(scene, newTheme, onlySlideIndex = null) {
  const prev = scene.theme || {}
  const next = {
    ...prev,
    ...newTheme,
    card: newTheme.card || deriveCardColor(newTheme.paper),
    fontHeading:
      newTheme.fontHeading ||
      (newTheme.display === 'serif'
        ? "Georgia, 'Songti SC', 'Noto Serif SC', serif"
        : "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif"),
    fontBody: newTheme.fontBody || prev.fontBody || "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  }

  const norm = (c) => String(c || '').trim().toLowerCase()
  const colorMap = new Map([
    [norm(prev.paper), next.paper],
    [norm(prev.ink), next.ink],
    [norm(prev.accent), next.accent],
    [norm(prev.second), next.second],
    [norm(prev.muted), next.muted],
    [norm(prev.rule), next.rule],
    [norm(prev.body), next.body],
    [norm(prev.card), next.card],
  ])

  const mapColor = (val, roleFallback) => {
    if (!val || val === 'transparent') return val
    const hit = colorMap.get(norm(val))
    if (hit) return hit
    return roleFallback || val
  }

  const targets = onlySlideIndex !== null ? [scene.slides[onlySlideIndex]].filter(Boolean) : scene.slides

  targets.forEach((sld) => {
    if (!sld.background || sld.background.type === 'theme') {
      sld.background = { ...(sld.background || {}), type: 'theme', color: next.paper }
    }
    for (const el of sld.elements || []) {
      const st = el.style || {}
      if (el.role === 'title' || el.role === 'item-title') {
        st.color = next.ink
        st.fontFamily = next.fontHeading
      } else if (el.role === 'kicker' || el.role === 'accent-num' || el.role === 'stat-num') {
        st.color = mapColor(st.color, next.accent)
        st.fontFamily = el.role === 'kicker' ? next.fontBody : next.fontHeading
      } else if (el.role === 'body') {
        st.color = next.body
        st.fontFamily = next.fontBody
      } else if (el.role === 'subtitle' || el.role === 'note' || el.role === 'folio-left' || el.role === 'folio-num') {
        st.color = next.muted
        st.fontFamily = next.fontBody
      } else {
        st.color = mapColor(st.color)
      }

      if (el.role === 'card') {
        st.fill = next.card
        st.stroke = mapColor(st.stroke, next.rule)
      } else if (el.role === 'rule') {
        st.fill = mapColor(st.fill, next.rule)
        st.stroke = mapColor(st.stroke, next.rule)
      } else if (el.role === 'accent') {
        st.fill = next.accent
      } else {
        st.fill = mapColor(st.fill)
        st.stroke = mapColor(st.stroke)
      }

      if (el.type === 'table') {
        el.headerFill = next.accent
        el.borderColor = next.rule
        st.color = next.ink
        st.fill = next.card
      }
      if (el.type === 'chart') {
        st.fill = next.card
        st.stroke = next.rule
        st.color = next.ink
        if (Array.isArray(el.series) && el.series[0]) el.series[0].color = next.accent
      }
      if (el.type === 'image' && el.artRef) {
        el.src = makeArtDataUrl(el.artRef, next)
      }
    }
  })

  if (onlySlideIndex === null) {
    scene.theme = next
  }
}

/**
 * 重新同步所有页码文字（增删或拖拽重排幻灯片后调用）
 */
export function syncFolioNumbers(scene) {
  scene.slides.forEach((sld, idx) => {
    for (const el of sld.elements || []) {
      if (el.role === 'folio-num') {
        el.text = String(idx + 1).padStart(2, '0')
      }
      if (el.role === 'folio-left' && scene.footLeft) {
        el.text = scene.footLeft
      }
    }
  })
}
