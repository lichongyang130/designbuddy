/**
 * 生成《河北省辛集市李章村小学课程表》PPT 的 4 套主色方案
 * 通过 POST /export/pptx-model 导出原生 .pptx
 */
import http from 'node:http'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:5178'

type Color = string

// 4 套主题色方案
const THEMES: Record<string, { name: string; theme: any }> = {
  blue: {
    name: '活力蓝',
    theme: {
      paper: '#FFFFFF',
      ink: '#17171B',
      accent: '#1F6FEB',
      second: '#0F766E',
      muted: '#6B7280',
      rule: '#E5E7EB',
      font: { display: 'sans', mono: 'ui-monospace,Menlo,monospace' },
    },
  },
  green: {
    name: '成长绿',
    theme: {
      paper: '#FFFFFF',
      ink: '#17171B',
      accent: '#059669',
      second: '#0F766E',
      muted: '#6B7280',
      rule: '#E5E7EB',
      font: { display: 'sans', mono: 'ui-monospace,Menlo,monospace' },
    },
  },
  orange: {
    name: '快乐橙',
    theme: {
      paper: '#FFFFFF',
      ink: '#17171B',
      accent: '#F59E0B',
      second: '#0F766E',
      muted: '#6B7280',
      rule: '#E5E7EB',
      font: { display: 'sans', mono: 'ui-monospace,Menlo,monospace' },
    },
  },
  multi: {
    name: '多彩拼贴',
    theme: {
      paper: '#FFFFFF',
      ink: '#111827',
      accent: '#111827',
      second: '#0F766E',
      muted: '#6B7280',
      rule: '#E5E7EB',
      font: { display: 'sans', mono: 'ui-monospace,Menlo,monospace' },
    },
  },
}

// 各科目独立色（方案4使用）
const SUBJECT_COLORS: Record<string, Color> = {
  语文: '#DC2626',
  数学: '#2563EB',
  英语: '#059669',
  科学: '#7C3AED',
  音乐: '#D97706',
  美术: '#DB2777',
  体育: '#0891B2',
  品社: '#6B7280',
  劳动: '#EA580C',
}

// 通用辅助
const M = 88
const CW = 1280 - M * 2

function text(id: string, x: number, y: number, w: number, h: number, content: string, style: any = {}) {
  return {
    id, type: 'text', x, y, w, h, text: content,
    style: {
      fontSize: 18,
      color: '#17171B',
      align: 'left',
      valign: 'top',
      lineHeight: 1.35,
      ...style,
    },
  }
}

function shape(id: string, x: number, y: number, w: number, h: number, kind: string, style: any = {}) {
  return { id, type: 'shape', x, y, w, h, shape: kind, style: { opacity: 1, ...style } }
}

// 生成一套完整的 presentation（7 页）
function buildPresentation(scheme: keyof typeof THEMES) {
  const { theme, name } = THEMES[scheme]
  const isMulti = scheme === 'multi'

  const accent = theme.accent
  const muted = theme.muted
  const ink = theme.ink

  // 封面
  const cover: any = {
    id: 'slide-cover',
    title: '封面',
    layout: 'cover',
    background: { color: theme.paper },
    elements: [
      text('el-cover-1', M, 150, CW, 100, '河北省辛集市李章村小学', {
        fontSize: 44, bold: true, color: accent, align: 'left', valign: 'middle',
      }),
      text('el-cover-2', M, 260, CW, 60, '课程表', {
        fontSize: 40, bold: true, color: ink, align: 'left', valign: 'middle',
      }),
      shape('el-cover-3', M, 340, 60, 5, 'rect', { fill: accent }),
      text('el-cover-4', M, 370, CW, 40, '2026 学年 · 秋季学期', {
        fontSize: 18, color: muted, align: 'left', valign: 'top',
      }),
      text('el-cover-5', M, 420, CW, 30, 'DesignBuddy PPT 原生引擎导出 · 16:9 宽屏', {
        fontSize: 14, color: theme.rule, align: 'left', valign: 'top',
      }),
    ],
  }

  // 学校概况
  const overview: any = {
    id: 'slide-overview',
    title: '学校概况',
    layout: 'statement',
    background: { color: theme.paper },
    elements: [
      text('el-ov-1', M, 60, CW, 44, '学校概况', {
        fontSize: 28, bold: true, color: accent, align: 'left', valign: 'top',
      }),
      text('el-ov-2', M, 130, CW, 30, '辛集市李章村小学坐落于河北省辛集市，是一所扎根社区的公办完全小学。', {
        fontSize: 18, color: ink, align: 'left', valign: 'top', lineHeight: 1.5,
      }),
      text('el-ov-3', M, 190, CW, 30, '校训：勤学 明理 健体 创新', {
        fontSize: 18, bold: true, color: accent, align: 'left', valign: 'top',
      }),
      shape('el-ov-4', M, 240, CW, 1, 'rect', { fill: theme.rule }),
      text('el-ov-5', M, 260, CW, 30, '办学理念：让每一个孩子都能在李章村小学找到适合自己的成长节奏。', {
        fontSize: 16, color: muted, align: 'left', valign: 'top', lineHeight: 1.4,
      }),
      text('el-ov-6', M, 310, CW, 30, '现有教学班 X 个，在校学生 X 名，专任教师 X 名，其中本科学历教师占比 XX%。', {
        fontSize: 16, color: muted, align: 'left', valign: 'top',
      }),
    ],
  }

  // 课程设置总览（各科目卡片）
  const subjects = ['语文', '数学', '英语', '科学', '音乐', '美术', '体育', '品社', '劳动']
  const courseElements: any[] = [
    text('el-course-1', M, 60, CW, 44, '课程设置总览', {
      fontSize: 28, bold: true, color: accent, align: 'left', valign: 'top',
    }),
  ]
  const cols = 3
  const cardW = (CW - 40) / cols
  const cardH = 110
  subjects.forEach((subj, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = M + col * (cardW + 20)
    const cy = 130 + row * (cardH + 16)
    const subjColor = isMulti ? SUBJECT_COLORS[subj] : accent
    courseElements.push(
      shape(`el-course-card-${subj}`, cx, cy, cardW, cardH, 'roundRect', {
        fill: isMulti ? '#F9FAFB' : '#E8F4FF',
        radius: 12,
        ...(isMulti ? {} : { stroke: subjColor, strokeWidth: 2 }),
      }),
      text(`el-course-name-${subj}`, cx + 20, cy + 16, cardW - 40, 34, subj, {
        fontSize: 24, bold: true, color: subjColor, align: 'left', valign: 'middle',
      }),
      text(`el-course-desc-${subj}`, cx + 20, cy + 56, cardW - 40, 44, `每周 ${Math.floor(3 + i % 3)} 节课`, {
        fontSize: 14, color: muted, align: 'left', valign: 'top',
      })
    )
  })
  const courses: any = {
    id: 'slide-courses',
    title: '课程设置总览',
    layout: 'columns',
    background: { color: theme.paper },
    elements: courseElements,
  }

  // 周课程表（周一～周五）
  const days = ['周一', '周二', '周三', '周四', '周五']
  const periods = [
    ['语文', '数学', '英语', '科学', '音乐'],
    ['数学', '语文', '体育', '英语', '美术'],
    ['英语', '科学', '语文', '数学', '体育'],
    ['科学', '体育', '数学', '语文', '英语'],
    ['音乐', '美术', '品社', '劳动', '阅读'],
  ]
  const tableElements: any[] = [
    text('el-table-1', M, 60, CW, 44, '本周课程表（周一～周五）', {
      fontSize: 28, bold: true, color: accent, align: 'left', valign: 'top',
    }),
  ]
  // 表格：第一列节次，后面5列星期
  const rows: string[][] = [['节次', ...days]]
  const periodLabels = ['第1节', '第2节', '第3节', '第4节', '第5节']
  for (let p = 0; p < 5; p++) {
    rows.push([periodLabels[p], ...periods[p]])
  }
  const tableW = CW
  const colW = tableW / 6
  const headerFill = isMulti ? '#111827' : accent
  const headerColor = '#FFFFFF'
  tableElements.push(
    shape('el-table-bg', M, 130, tableW, 330, 'rect', { fill: '#FFFFFF', opacity: 1 }),
    {
      id: 'el-week-table',
      type: 'table',
      x: M,
      y: 130,
      w: tableW,
      h: 330,
      rows,
      headerRow: true,
      zebra: true,
      headerFill,
      headerColor,
      borderColor: theme.rule,
    } as any
  )
  // 表格下方说明
  tableElements.push(
    text('el-table-note', M, 480, CW, 30, '注：具体上课时间以校务公布为准，遇法定节假日顺延。', {
      fontSize: 14, color: muted, align: 'left', valign: 'top',
    })
  )
  const week: any = {
    id: 'slide-week',
    title: '周课程表',
    layout: 'table',
    background: { color: theme.paper },
    elements: tableElements,
  }

  // 各科目特色
  const featureElements: any[] = [
    text('el-feat-1', M, 60, CW, 44, '各科目教学特色', {
      fontSize: 28, bold: true, color: accent, align: 'left', valign: 'top',
    }),
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
    const subjColor = isMulti ? SUBJECT_COLORS[f.subj] : accent
    featureElements.push(
      shape(`el-feat-dot-${i}`, M, 130 + i * 78, 12, 12, 'ellipse', { fill: subjColor }),
      text(`el-feat-name-${i}`, M + 30, 125 + i * 78, 200, 34, f.subj, {
        fontSize: 20, bold: true, color: subjColor, align: 'left', valign: 'middle',
      }),
      text(`el-feat-desc-${i}`, M + 260, 130 + i * 78, CW - M - 260, 68, f.desc, {
        fontSize: 16, color: ink, align: 'left', valign: 'top', lineHeight: 1.4,
      })
    )
  })
  const featuresSlide: any = {
    id: 'slide-features',
    title: '各科目特色',
    layout: 'statement',
    background: { color: theme.paper },
    elements: featureElements,
  }

  // 使用须知
  const usage: any = {
    id: 'slide-usage',
    title: '使用须知',
    layout: 'statement',
    background: { color: theme.paper },
    elements: [
      text('el-use-1', M, 60, CW, 44, '课程表使用须知', {
        fontSize: 28, bold: true, color: accent, align: 'left', valign: 'top',
      }),
      text('el-use-2', M, 130, CW, 30, '1. 课程表每学期调整一次，调整前会提前一周向家长公示。', {
        fontSize: 17, color: ink, align: 'left', valign: 'top', lineHeight: 1.4,
      }),
      text('el-use-3', M, 180, CW, 30, '2. 如遇公众假期或学校活动，当日课程顺延或合并，以班群通知为准。', {
        fontSize: 17, color: ink, align: 'left', valign: 'top', lineHeight: 1.4,
      }),
      text('el-use-4', M, 230, CW, 30, '3. 课程表电子版已发送至家校沟通群，建议保存至手机相册方便查阅。', {
        fontSize: 17, color: ink, align: 'left', valign: 'top', lineHeight: 1.4,
      }),
      text('el-use-5', M, 280, CW, 30, '4. 如有疑问，请联系班主任或学校教务处。', {
        fontSize: 17, color: ink, align: 'left', valign: 'top', lineHeight: 1.4,
      }),
    ],
  }

  // 结束页
  const end: any = {
    id: 'slide-end',
    title: '结束页',
    layout: 'end',
    background: { color: theme.paper },
    elements: [
      text('el-end-1', M, 220, CW, 80, '谢谢聆听', {
        fontSize: 44, bold: true, color: accent, align: 'center', valign: 'middle',
      }),
      text('el-end-2', M, 320, CW, 30, '河北省辛集市李章村小学 · 课程表', {
        fontSize: 18, color: muted, align: 'center', valign: 'middle',
      }),
      shape('el-end-3', M + CW / 2 - 30, 370, 60, 4, 'rect', { fill: accent }),
      text('el-end-4', M, 400, CW, 30, '教务处联系电话：XXX-XXXXXXX', {
        fontSize: 16, color: ink, align: 'center', valign: 'middle',
      }),
    ],
  }

  return {
    id: `presentation-timetable-${scheme}-${Date.now().toString(36)}`,
    title: `李章村小学课程表（${name}方案）`,
    author: 'DesignBuddy',
    ratio: '16:9',
    theme,
    slides: [cover, overview, courses, week, featuresSlide, usage, end],
  }
}

async function postJson(path: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = http.request(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let buf = ''
      res.on('data', (c) => (buf += c))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(buf) })
        } catch {
          resolve({ status: res.statusCode, body: buf })
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  const schemes: (keyof typeof THEMES)[] = ['blue', 'green', 'orange', 'multi']
  const outDir = '/home/user/designbuddy/output/school-timetable'
  fs.mkdirSync(outDir, { recursive: true })

  for (const scheme of schemes) {
    const pres = buildPresentation(scheme)
    console.log(`\n=== 正在生成方案：${THEMES[scheme].name} ===`)
    const res = await postJson('/export/pptx-model', {
      filename: `李章村小学课程表-${THEMES[scheme].name}`,
      presentation: pres,
    })
    console.log('状态码:', res.status)
    if (res.body.ok) {
      const fileUrl = `${BASE}${res.body.url}`
      console.log('PPTX 已生成:', res.body.name, '(', res.body.bytes, '字节)')
      console.log('下载地址:', fileUrl)
      // 下载并保存到本地
      const fileRes = await new Promise<any>((resolve, reject) => {
        http.get(fileUrl, (res2) => {
          const chunks: Buffer[] = []
          res2.on('data', (c) => chunks.push(c))
          res2.on('end', () => resolve(Buffer.concat(chunks)))
        }).on('error', reject)
      })
      const filePath = `${outDir}/李章村小学课程表-${THEMES[scheme].name}.pptx`
      fs.writeFileSync(filePath, fileRes as Buffer)
      console.log('已保存:', filePath, '大小:', (fileRes as Buffer).length, '字节')
    } else {
      console.error('导出失败:', res.body)
    }
  }
  console.log('\n全部 4 套方案生成完毕。')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
