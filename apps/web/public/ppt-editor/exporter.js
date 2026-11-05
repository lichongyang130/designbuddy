/**
 * 多格式成品导出引擎：
 * 1. 导出真 `.pptx`（调用 POST /export/pptx，矢量 SVG 配图自动栅格化为高清 PNG 内嵌，WPS / Office 原生可编辑）
 * 2. 导出高清多页 `.pdf`（客户端 2x 画布逐页绘制并封装为标准 PDF 1.4 二进制文件直接下载）
 * 3. 导出当前页高清 `.png`（2560×1440 超清像素图）
 */

import { renderShapeSvg } from './presets.js'
import { chartSvgToDataUrl } from './charts.js'
import { slideStageDimensions } from './canvas.js'

function triggerDownload(href, filename) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

function drawImageCrop(ctx, img, el, x, y, w, h) {
  const iw=img.naturalWidth || img.width, ih=img.naturalHeight || img.height
  const zoom=Math.max(1,Math.min(3,Number(el.cropZoom ?? 1)))
  const fit=el.objectFit === 'contain' ? Math.min(w/iw,h/ih) : Math.max(w/iw,h/ih)
  const dw=iw*fit*zoom, dh=ih*fit*zoom
  // CSS object-position is computed before the centered zoom transform.
  const px=Math.max(0,Math.min(100,Number(el.cropX ?? 50)))/100
  const py=Math.max(0,Math.min(100,Number(el.cropY ?? 50)))/100
  const dx=x+w/2+((w-iw*fit)*px-w/2)*zoom
  const dy=y+h/2+((h-ih*fit)*py-h/2)*zoom
  ctx.drawImage(img,dx,dy,dw,dh)
}

async function rasterizeImage(el) {
  const img=await loadImage(el.src), c=document.createElement('canvas')
  c.width=Math.max(1,Math.round(el.w*2)); c.height=Math.max(1,Math.round(el.h*2))
  const ctx=c.getContext('2d'); ctx.save(); ctx.beginPath()
  if(el.shape==='circle') ctx.ellipse(c.width/2,c.height/2,c.width/2,c.height/2,0,0,Math.PI*2)
  else ctx.roundRect(0,0,c.width,c.height, Math.min(c.width/2,c.height/2,Number(el.style?.radius ?? 12)*2))
  ctx.clip(); drawImageCrop(ctx,img,el,0,0,c.width,c.height); ctx.restore()
  return c.toDataURL('image/png')
}

/**
 * 1. 导出原生可编辑 .pptx
 */
export async function exportSceneToPptx(scene) {
  const payloadSlides = []
  for (const sld of scene.slides) {
    const outEls = []
    for (const el of sld.elements || []) {
      const copy = JSON.parse(JSON.stringify(el))
      if (copy.type === 'image' && copy.src) copy.src = await rasterizeImage(copy)
      outEls.push(copy)
    }
    const bg = sld.background || {}
    const bgOut = {}
    if (bg.type === 'gradient' && bg.gradient?.from && bg.gradient?.to) {
      bgOut.gradient = bg.gradient
    } else {
      bgOut.color = bg.type === 'solid' && bg.color ? bg.color : scene.theme.paper
    }
    if ((bg.type === 'image' && bg.image) || (bg.pattern && bg.pattern !== 'none')) {
      const {w,h} = slideStageDimensions(scene)
      const backgroundCanvas = await renderSlideToCanvas(scene, {...sld, elements: []}, 2)
      outEls.unshift({type:'image', x:0, y:0, w, h, src:backgroundCanvas.toDataURL('image/png'), style:{radius:0}})
    }
    payloadSlides.push({
      title: sld.label || '',
      hidden: Boolean(sld.hidden),
      notes: sld.notes || '',
      background: bgOut,
      transition: sld.transition || { type: 'fade', durationMs: 450 },
      elements: outEls,
    })
  }

  const res = await fetch('/export/pptx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: scene.title || 'presentation',
      deck: {
        title: scene.title || '演示文稿',
        ratio: scene.ratio || '16:9',
        theme: scene.theme,
        slides: payloadSlides,
      },
    }),
  })
  const data = await res.json()
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'PPTX 导出失败')
  }
  triggerDownload(data.url, data.name)
  return data
}

function wrapCanvasLines(ctx, text, maxW) {
  const out = []
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    if (rawLine === '') {
      out.push('')
      continue
    }
    let cur = ''
    for (const ch of rawLine) {
      const test = cur + ch
      if (ctx.measureText(test).width > maxW && cur !== '') {
        out.push(cur)
        cur = ch
      } else {
        cur = test
      }
    }
    if (cur !== '') out.push(cur)
  }
  return out
}

/**
 * 将单页幻灯片真实绘制到高清 HTML5 Canvas（用于导出 PNG 和 PDF）
 */
export async function renderSlideToCanvas(scene, slide, scale = 2) {
  const { w, h } = slideStageDimensions(scene)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  // 背景
  const bg = slide.background || { type: 'theme' }
  if (bg.type === 'gradient' && bg.gradient?.from && bg.gradient?.to) {
    const grd = ctx.createLinearGradient(0, 0, w, h)
    grd.addColorStop(0, bg.gradient.from)
    grd.addColorStop(1, bg.gradient.to)
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, w, h)
  } else {
    ctx.fillStyle = (bg.type === 'solid' && bg.color) || scene.theme.paper || '#FBFAF6'
    ctx.fillRect(0, 0, w, h)
  }
  if (bg.type === 'image' && bg.image) {
    try {
      const img = await loadImage(bg.image)
      ctx.save(); ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();drawImageCrop(ctx,img,{objectFit:'cover'},0,0,w,h);ctx.restore()
    } catch {
      throw new Error('背景图片加载失败，无法导出')
    }
  }

  if (bg.pattern && bg.pattern !== 'none') {
    ctx.save(); ctx.strokeStyle=scene.theme.rule||'#dddddd';ctx.fillStyle=scene.theme.rule||'#dddddd';ctx.lineWidth=1
    if (bg.pattern === 'dots') {for(let x=0;x<w;x+=24)for(let y=0;y<h;y+=24){ctx.beginPath();ctx.arc(x,y,1.2,0,Math.PI*2);ctx.fill()}}
    if (bg.pattern === 'grid') {ctx.beginPath();for(let x=0;x<w;x+=40){ctx.moveTo(x,0);ctx.lineTo(x,h)}for(let y=0;y<h;y+=40){ctx.moveTo(0,y);ctx.lineTo(w,y)}ctx.stroke()}
    ctx.restore()
  }

  for (const el of slide.elements || []) {
    const st = el.style || {}
    ctx.save()
    ctx.globalAlpha = Number(st.opacity ?? 1)
    const cx = el.x + el.w / 2
    const cy = el.y + el.h / 2
    if (el.rotation) {
      ctx.translate(cx, cy)
      ctx.rotate((el.rotation * Math.PI) / 180)
      ctx.translate(-cx, -cy)
    }

    if (el.type === 'shape') {
      const svgStr = renderShapeSvg(el.shape || 'roundRect', el.w, el.h, st, el.id)
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`
      try {
        const img = await loadImage(svgUrl)
        ctx.drawImage(img, el.x, el.y, el.w, el.h)
      } catch {
        /* ignore */
      }
      if (el.text && el.shape !== 'line') {
        drawStyledTextOnCanvas(ctx, el.text, el.x, el.y, el.w, el.h, st, scene, 'middle')
      }
    } else if (el.type === 'text') {
      if (st.fill && st.fill !== 'transparent') {
        ctx.fillStyle = st.fill
        ctx.beginPath()
        ctx.roundRect(el.x, el.y, el.w, el.h, Number(st.radius ?? 6))
        ctx.fill()
      }
      if (st.stroke && (st.strokeWidth || 0) > 0) {
        ctx.strokeStyle = st.stroke
        ctx.lineWidth = Number(st.strokeWidth)
        ctx.beginPath()
        ctx.roundRect(el.x, el.y, el.w, el.h, Number(st.radius ?? 6))
        ctx.stroke()
      }
      drawStyledTextOnCanvas(ctx, el.text, el.x, el.y, el.w, el.h, st, scene, 'top')
    } else if (el.type === 'image' && el.src) {
      try {
        const img = await loadImage(el.src)
        ctx.save()
        ctx.beginPath()
        if (el.shape === 'circle') {
          ctx.ellipse(el.x + el.w / 2, el.y + el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2)
        } else {
          ctx.roundRect(el.x, el.y, el.w, el.h, Number(st.radius ?? 12))
        }
        ctx.clip()
        drawImageCrop(ctx, img, el, el.x, el.y, el.w, el.h)
        ctx.restore()
      } catch {
        throw new Error('图片加载失败，无法导出')
      }
    } else if (el.type === 'chart') {
      try {
        const chartImg = await loadImage(chartSvgToDataUrl(el, scene.theme))
        ctx.drawImage(chartImg, el.x, el.y, el.w, el.h)
      } catch {
        /* ignore */
      }
    } else if (el.type === 'table') {
      const rows = el.rows || []
      const rCount = Math.max(1, rows.length)
      const cCount = Math.max(1, ...rows.map((r) => r.length))
      const cw = el.w / cCount
      const rh = el.h / rCount
      rows.forEach((row, rIdx) => {
        const isHead = el.headerRow !== false && rIdx === 0
        for (let cIdx = 0; cIdx < cCount; cIdx += 1) {
          const cellX = el.x + cIdx * cw
          const cellY = el.y + rIdx * rh
          ctx.fillStyle = isHead
            ? el.headerFill || scene.theme.accent
            : el.zebra && rIdx % 2 === 1
              ? 'rgba(128,128,140,0.1)'
              : st.fill || scene.theme.card
          ctx.fillRect(cellX, cellY, cw, rh)
          ctx.strokeStyle = el.borderColor || scene.theme.rule
          ctx.lineWidth = 1
          ctx.strokeRect(cellX, cellY, cw, rh)
          drawStyledTextOnCanvas(
            ctx,
            String(row[cIdx] ?? ''),
            cellX,
            cellY,
            cw,
            rh,
            {
              fontSize: st.fontSize ?? 15,
              bold: isHead || st.bold,
              color: isHead ? el.headerColor || '#FFFFFF' : st.color || scene.theme.ink,
              align: st.align || 'left',
              valign: 'middle',
              padding: 10,
            },
            scene,
            'middle',
          )
        }
      })
    }

    ctx.restore()
  }

  return canvas
}

function drawStyledTextOnCanvas(ctx, text, x, y, w, h, st, scene, defaultValign) {
  const pad = Number(st.padding ?? 8)
  const fs = Number(st.fontSize ?? 18)
  const lh = fs * Number(st.lineHeight ?? 1.38)
  const font = st.fontFamily || scene.theme.fontBody || 'sans-serif'
  ctx.font = `${st.italic ? 'italic ' : ''}${st.bold ? '700 ' : '400 '}${fs}px ${font}`
  ctx.fillStyle = st.color || scene.theme.ink || '#141412'
  ctx.textBaseline = 'top'

  const rawText = st.bullet
    ? String(text || '')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l, idx) => (st.bullet === 'number' ? `${idx + 1}. ${l.replace(/^\d+[.)、]\s*/, '')}` : `• ${l.replace(/^[•\-*]\s*/, '')}`))
        .join('\n')
    : String(text || '')

  const lines = wrapCanvasLines(ctx, rawText, Math.max(20, w - pad * 2))
  const totalH = lines.length * lh
  const valign = st.valign || defaultValign
  let startY = y + pad
  if (valign === 'middle') startY = y + Math.max(pad, (h - totalH) / 2)
  else if (valign === 'bottom') startY = y + Math.max(pad, h - pad - totalH)

  lines.forEach((line, idx) => {
    const ly = startY + idx * lh
    if (ly + fs > y + h + 6) return
    const lw = ctx.measureText(line).width
    let lx = x + pad
    if (st.align === 'center') lx = x + (w - lw) / 2
    else if (st.align === 'right') lx = x + w - pad - lw
    ctx.fillText(line, lx, ly)
  })
}

/**
 * 2. 导出单页超清 .png
 */
export async function exportSlideToPng(scene, slideIndex) {
  const slide = scene.slides[slideIndex]
  if (!slide) return
  const canvas = await renderSlideToCanvas(scene, slide, 2)
  const safeTitle = (scene.title || 'slide').replace(/[\\/:*?"<>|]+/g, '-')
  triggerDownload(canvas.toDataURL('image/png'), `${safeTitle}-P${String(slideIndex + 1).padStart(2, '0')}.png`)
}

/**
 * 3. 零依赖生成多页真实 .pdf 二进制文件并直接下载
 */
export async function exportSceneToPdf(scene) {
  const visible = scene.slides.filter((s) => !s.hidden)
  if (visible.length === 0) throw new Error('没有可导出的可见页面')

  const { w: pageW, h: pageH } = slideStageDimensions(scene)
  const jpegPages = []
  for (const slide of visible) {
    const canvas = await renderSlideToCanvas(scene, slide, 1.75)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const bin = atob(dataUrl.split(',')[1])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
    jpegPages.push({ bytes, pixelW: canvas.width, pixelH: canvas.height })
  }

  // 构建 PDF 1.4 对象表：1 = Catalog, 2 = Pages, 后续每页占 3 个对象（Page, Content, Image XObject）
  const chunks = []
  let byteLen = 0
  const enc = new TextEncoder()
  const pushStr = (s) => {
    const b = enc.encode(s)
    chunks.push(b)
    byteLen += b.length
  }
  const pushBytes = (b) => {
    chunks.push(b)
    byteLen += b.length
  }

  const offsets = [0]
  const startObj = (id) => {
    offsets[id] = byteLen
    pushStr(`${id} 0 obj\n`)
  }
  const endObj = () => pushStr(`\nendobj\n`)

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')

  startObj(1)
  pushStr('<< /Type /Catalog /Pages 2 0 R >>')
  endObj()

  const pageObjIds = jpegPages.map((_, i) => 3 + i * 3)
  startObj(2)
  pushStr(`<< /Type /Pages /Count ${jpegPages.length} /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] >>`)
  endObj()

  jpegPages.forEach((pg, idx) => {
    const pageId = 3 + idx * 3
    const contentId = pageId + 1
    const imgId = pageId + 2
    const imgName = `/Im${idx + 1}`
    const contentStream = `q ${pageW} 0 0 ${pageH} 0 0 cm ${imgName} Do Q`
    const contentBytes = enc.encode(contentStream)

    startObj(pageId)
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << ${imgName} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )
    endObj()

    startObj(contentId)
    pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`)
    pushBytes(contentBytes)
    pushStr(`\nendstream`)
    endObj()

    startObj(imgId)
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${pg.pixelW} /Height ${pg.pixelH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`,
    )
    pushBytes(pg.bytes)
    pushStr(`\nendstream`)
    endObj()
  })

  const totalObjs = 2 + jpegPages.length * 3
  const xrefPos = byteLen
  pushStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`)
  for (let id = 1; id <= totalObjs; id += 1) {
    pushStr(`${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`)
  }
  pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`)

  const blob = new Blob(chunks, { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const safeTitle = (scene.title || 'presentation').replace(/[\\/:*?"<>|]+/g, '-')
  triggerDownload(url, `${safeTitle}.pdf`)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Store-only ZIP. CRC and offsets are computed over bytes, including UTF-8 names.
export function makeStoredZip(entries) {
  const encoder = new TextEncoder(), chunks = [], central = []
  let offset = 0
  const crcTable = Array.from({length:256}, (_, i) => { let c=i; for(let j=0;j<8;j++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); return c>>>0 })
  const header = (length) => { const bytes = new Uint8Array(length); return [bytes, new DataView(bytes.buffer)] }
  for (const entry of entries) {
    const name=encoder.encode(entry.name), data=entry.bytes
    let crc=0xffffffff; for(const byte of data) crc=crcTable[(crc^byte)&255]^(crc>>>8); crc=(crc^0xffffffff)>>>0
    const [local, lv]=header(30); lv.setUint32(0,0x04034b50,true); lv.setUint16(4,20,true); lv.setUint16(6,0x800,true); lv.setUint32(14,crc,true); lv.setUint32(18,data.length,true); lv.setUint32(22,data.length,true); lv.setUint16(26,name.length,true)
    const [cd, cv]=header(46); cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true); cv.setUint16(8,0x800,true); cv.setUint32(16,crc,true); cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true); cv.setUint16(28,name.length,true); cv.setUint32(42,offset,true)
    chunks.push(local,name,data); central.push(cd,name); offset+=local.length+name.length+data.length
  }
  const centralSize=central.reduce((n,x)=>n+x.length,0), [end,ev]=header(22)
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true)
  return new Blob([...chunks,...central,end],{type:'application/zip'})
}

export async function exportSceneToPngZip(scene) {
  const entries=[]
  for (let i=0; i<scene.slides.length; i++) {
    if (scene.slides[i].hidden) continue
    const canvas=await renderSlideToCanvas(scene,scene.slides[i],2)
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 导出失败')),'image/png'))
    entries.push({name:`slide-${String(i+1).padStart(2,'0')}.png`,bytes:new Uint8Array(await blob.arrayBuffer())})
  }
  if (!entries.length) throw new Error('没有可导出的可见页面')
  const url=URL.createObjectURL(makeStoredZip(entries))
  triggerDownload(url,`${(scene.title||'presentation').replace(/[\\/:*?"<>|]+/g,'-')}.zip`)
  setTimeout(()=>URL.revokeObjectURL(url),10000)
}
