/**
 * 原生矢量图表渲染器（零外部图表库依赖，输出高分 SVG）
 * 支持：簇状柱形图 (column) / 横向条形图 (bar) / 折线图 (line) / 面积图 (area) / 饼图 (pie) / 环形图 (donut)
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function chartPaletteFor(theme, customColors) {
  if (Array.isArray(customColors) && customColors.length > 0) return customColors
  return [
    theme?.accent || '#1F4FFF',
    theme?.second || '#0F766E',
    '#F59E0B',
    '#EC4899',
    '#8B5CF6',
    '#10B981',
  ]
}

export function renderChartSvg(el, theme = {}) {
  const W = Math.max(180, Math.round(Number(el.w) || 520))
  const H = Math.max(140, Math.round(Number(el.h) || 300))
  const ink = el.style?.color || theme.ink || '#141412'
  const muted = theme.muted || '#6D6A63'
  const rule = theme.rule || '#E2DED4'
  const bg = el.style?.fill && el.style.fill !== 'transparent' ? el.style.fill : 'transparent'
  const stroke = el.style?.stroke && (el.style?.strokeWidth || 0) > 0 ? el.style.stroke : 'none'
  const sw = Number(el.style?.strokeWidth) || 0
  const radius = Number(el.style?.radius ?? 12)
  const palette = chartPaletteFor(theme, el.colors)

  const cats = Array.isArray(el.categories) && el.categories.length > 0 ? el.categories : ['Q1', 'Q2', 'Q3', 'Q4']
  const series =
    Array.isArray(el.series) && el.series.length > 0
      ? el.series
      : [{ name: '核心指标', values: [32, 54, 78, 112] }]

  const showValues = el.showValues !== false
  const showLegend = el.showLegend !== false && (series.length > 1 || el.chartType === 'pie' || el.chartType === 'donut')
  const showGrid = el.showGrid !== false
  const unit = el.unit ? String(el.unit) : ''

  const parts = []
  if (bg !== 'transparent' || stroke !== 'none') {
    parts.push(`<rect x="${sw / 2}" y="${sw / 2}" width="${W - sw}" height="${H - sw}" rx="${radius}" fill="${esc(bg)}" stroke="${esc(stroke)}" stroke-width="${sw}"/>`)
  }

  let topY = 18
  if (el.chartTitle) {
    parts.push(`<text x="20" y="32" fill="${esc(ink)}" font-size="16" font-weight="600">${esc(el.chartTitle)}</text>`)
    topY = 48
  }

  const bottomPad = showLegend && el.chartType !== 'pie' && el.chartType !== 'donut' ? 54 : 34
  const chartType = el.chartType || 'column'

  if (chartType === 'pie' || chartType === 'donut') {
    const vals = (series[0]?.values || [40, 30, 20, 10]).map((v) => Math.max(0, Number(v) || 0))
    const total = Math.max(0.0001, vals.reduce((a, b) => a + b, 0))
    const availH = H - topY - 18
    const cx = showLegend ? Math.round(W * 0.34) : Math.round(W * 0.5)
    const cy = Math.round(topY + availH / 2)
    const R = Math.max(36, Math.min(cx - 24, availH / 2 - 12))
    const rInner = chartType === 'donut' ? R * 0.56 : 0

    let startAngle = -Math.PI / 2
    vals.forEach((val, idx) => {
      const frac = val / total
      const angle = frac * Math.PI * 2
      const endAngle = startAngle + angle
      const color = palette[idx % palette.length]
      if (frac >= 0.9999) {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${esc(color)}"/>`)
        if (rInner > 0) parts.push(`<circle cx="${cx}" cy="${cy}" r="${rInner}" fill="${esc(bg !== 'transparent' ? bg : theme.paper || '#FFFFFF')}"/>`)
      } else if (frac > 0.001) {
        const x1 = cx + R * Math.cos(startAngle)
        const y1 = cy + R * Math.sin(startAngle)
        const x2 = cx + R * Math.cos(endAngle)
        const y2 = cy + R * Math.sin(endAngle)
        const large = angle > Math.PI ? 1 : 0
        if (rInner > 0) {
          const ix1 = cx + rInner * Math.cos(endAngle)
          const iy1 = cy + rInner * Math.sin(endAngle)
          const ix2 = cx + rInner * Math.cos(startAngle)
          const iy2 = cy + rInner * Math.sin(startAngle)
          parts.push(
            `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix1.toFixed(2)} ${iy1.toFixed(2)} A ${rInner} ${rInner} 0 ${large} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)} Z" fill="${esc(color)}"/>`,
          )
        } else {
          parts.push(
            `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${esc(color)}"/>`,
          )
        }
      }
      startAngle = endAngle
    })

    if (chartType === 'donut') {
      parts.push(`<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="${esc(muted)}" font-size="11">合计</text>`)
      parts.push(`<text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="${esc(ink)}" font-size="18" font-weight="700">${esc(Math.round(total * 10) / 10)}${esc(unit)}</text>`)
    }

    if (showLegend) {
      const lx = Math.round(W * 0.62)
      const rowH = Math.min(30, Math.max(20, availH / Math.max(1, cats.length)))
      const startY = cy - ((cats.length - 1) * rowH) / 2
      cats.forEach((cat, idx) => {
        const val = vals[idx] ?? 0
        const pct = Math.round((val / total) * 100)
        const ly = startY + idx * rowH
        const color = palette[idx % palette.length]
        parts.push(`<rect x="${lx}" y="${ly - 9}" width="11" height="11" rx="3" fill="${esc(color)}"/>`)
        parts.push(`<text x="${lx + 18}" y="${ly + 1}" fill="${esc(ink)}" font-size="12">${esc(cat)}</text>`)
        parts.push(`<text x="${W - 20}" y="${ly + 1}" text-anchor="end" fill="${esc(muted)}" font-size="12" font-weight="600">${pct}%</text>`)
      })
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="display:block;font-family:ui-sans-serif,system-ui,'PingFang SC',sans-serif">${parts.join('')}</svg>`
  }

  const allNums = series.flatMap((s) => (s.values || []).map((v) => Math.max(0, Number(v) || 0)))
  const rawMax = Math.max(1, Number(el.max) || 0, ...allNums)
  const niceStep = Math.pow(10, Math.floor(Math.log10(rawMax))) / 2 || 1
  const maxVal = Math.ceil(rawMax / niceStep) * niceStep || rawMax

  if (chartType === 'bar') {
    const padLeft = Math.min(148, Math.max(84, Math.max(...cats.map((c) => String(c).length)) * 13 + 22))
    const padRight = showValues ? 62 : 24
    const plotX = padLeft
    const plotY = topY + 4
    const plotW = Math.max(60, W - padLeft - padRight)
    const plotH = Math.max(60, H - plotY - (showLegend ? 44 : 20))
    const rowH = plotH / Math.max(1, cats.length)

    if (showGrid) {
      for (let g = 0; g <= 4; g += 1) {
        const gx = plotX + (plotW * g) / 4
        parts.push(`<line x1="${gx.toFixed(1)}" y1="${plotY}" x2="${gx.toFixed(1)}" y2="${plotY + plotH}" stroke="${esc(rule)}" stroke-width="1" stroke-dasharray="${g === 0 ? '' : '3 3'}"/>`)
      }
    }

    cats.forEach((cat, cIdx) => {
      const cy = plotY + cIdx * rowH
      parts.push(`<text x="${plotX - 12}" y="${(cy + rowH / 2 + 4).toFixed(1)}" text-anchor="end" fill="${esc(ink)}" font-size="13">${esc(cat)}</text>`)
      const bandH = Math.min(26, Math.max(8, (rowH * 0.64) / series.length))
      const totalBandsH = series.length * bandH + (series.length - 1) * 3
      const startBy = cy + (rowH - totalBandsH) / 2

      series.forEach((s, sIdx) => {
        const val = Math.max(0, Number(s.values?.[cIdx]) || 0)
        const bw = Math.max(4, (val / maxVal) * plotW)
        const by = startBy + sIdx * (bandH + 3)
        const color = s.color || palette[sIdx % palette.length]
        // 轨道底色
        if (series.length === 1) {
          parts.push(`<rect x="${plotX}" y="${by.toFixed(1)}" width="${plotW}" height="${bandH.toFixed(1)}" rx="5" fill="${esc(rule)}" opacity="0.45"/>`)
        }
        parts.push(`<rect x="${plotX}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bandH.toFixed(1)}" rx="5" fill="${esc(color)}"/>`)
        if (showValues) {
          parts.push(`<text x="${(plotX + bw + 8).toFixed(1)}" y="${(by + bandH / 2 + 4).toFixed(1)}" fill="${esc(ink)}" font-size="12" font-weight="600">${esc(val)}${esc(unit)}</text>`)
        }
      })
    })
  } else {
    // column / line / area
    const padLeft = 52
    const padRight = 24
    const plotX = padLeft
    const plotY = topY + 10
    const plotW = Math.max(80, W - padLeft - padRight)
    const plotH = Math.max(60, H - plotY - bottomPad)

    for (let g = 0; g <= 4; g += 1) {
      const gy = plotY + (plotH * g) / 4
      const tick = Math.round((maxVal * (1 - g / 4)) * 10) / 10
      if (showGrid || g === 4) {
        parts.push(`<line x1="${plotX}" y1="${gy.toFixed(1)}" x2="${plotX + plotW}" y2="${gy.toFixed(1)}" stroke="${esc(rule)}" stroke-width="1" ${g < 4 ? 'stroke-dasharray="3 3"' : ''}/>`)
      }
      parts.push(`<text x="${plotX - 8}" y="${(gy + 4).toFixed(1)}" text-anchor="end" fill="${esc(muted)}" font-size="11">${esc(tick)}</text>`)
    }

    const groupW = plotW / Math.max(1, cats.length)
    cats.forEach((cat, cIdx) => {
      const gx = plotX + cIdx * groupW + groupW / 2
      parts.push(`<text x="${gx.toFixed(1)}" y="${plotY + plotH + 20}" text-anchor="middle" fill="${esc(muted)}" font-size="12">${esc(cat)}</text>`)
    })

    if (chartType === 'line' || chartType === 'area') {
      series.forEach((s, sIdx) => {
        const color = s.color || palette[sIdx % palette.length]
        const pts = cats.map((_, cIdx) => {
          const val = Math.max(0, Number(s.values?.[cIdx]) || 0)
          const px = plotX + cIdx * groupW + groupW / 2
          const py = plotY + plotH - (val / maxVal) * plotH
          return { px, py, val }
        })
        if (pts.length > 0) {
          const dLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ')
          if (chartType === 'area' && pts.length > 1) {
            const dArea = `${dLine} L ${pts[pts.length - 1].px.toFixed(1)} ${(plotY + plotH).toFixed(1)} L ${pts[0].px.toFixed(1)} ${(plotY + plotH).toFixed(1)} Z`
            parts.push(`<path d="${dArea}" fill="${esc(color)}" opacity="0.16"/>`)
          }
          parts.push(`<path d="${dLine}" fill="none" stroke="${esc(color)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`)
          pts.forEach((p) => {
            parts.push(`<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="4.5" fill="${esc(theme.paper || '#FFFFFF')}" stroke="${esc(color)}" stroke-width="2.5"/>`)
            if (showValues) {
              parts.push(`<text x="${p.px.toFixed(1)}" y="${Math.max(14, p.py - 10).toFixed(1)}" text-anchor="middle" fill="${esc(ink)}" font-size="11" font-weight="600">${esc(p.val)}${esc(unit)}</text>`)
            }
          })
        }
      })
    } else {
      // column
      const colW = Math.min(44, Math.max(8, (groupW * 0.62) / series.length))
      const totalColsW = series.length * colW + (series.length - 1) * 4
      cats.forEach((_, cIdx) => {
        const startX = plotX + cIdx * groupW + (groupW - totalColsW) / 2
        series.forEach((s, sIdx) => {
          const val = Math.max(0, Number(s.values?.[cIdx]) || 0)
          const bh = Math.max(3, (val / maxVal) * plotH)
          const bx = startX + sIdx * (colW + 4)
          const by = plotY + plotH - bh
          const color = s.color || palette[sIdx % palette.length]
          parts.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${colW.toFixed(1)}" height="${bh.toFixed(1)}" rx="5" fill="${esc(color)}"/>`)
          if (showValues) {
            parts.push(`<text x="${(bx + colW / 2).toFixed(1)}" y="${Math.max(14, by - 6).toFixed(1)}" text-anchor="middle" fill="${esc(ink)}" font-size="11" font-weight="600">${esc(val)}${esc(unit)}</text>`)
          }
        })
      })
    }

    if (showLegend) {
      const itemW = 104
      const startLx = Math.max(20, (W - series.length * itemW) / 2)
      const ly = H - 14
      series.forEach((s, sIdx) => {
        const color = s.color || palette[sIdx % palette.length]
        const lx = startLx + sIdx * itemW
        parts.push(`<rect x="${lx.toFixed(1)}" y="${ly - 9}" width="10" height="10" rx="2.5" fill="${esc(color)}"/>`)
        parts.push(`<text x="${(lx + 15).toFixed(1)}" y="${ly}" fill="${esc(muted)}" font-size="11">${esc(s.name || `系列 ${sIdx + 1}`)}</text>`)
      })
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="display:block;font-family:ui-sans-serif,system-ui,'PingFang SC',sans-serif">${parts.join('')}</svg>`
}

export function chartSvgToDataUrl(el, theme) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderChartSvg(el, theme))}`
}
