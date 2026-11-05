import { parseChartData } from './chart-data.js'
import { compileDeckToScene, createSlideFromLayout, uid, applyThemeToSlides, switchSlideLayout, syncFolioNumbers } from './compiler.js'
import { renderSlideStageHtml, attachCanvasInteractions, slideStageDimensions } from './canvas.js'
import { WPS_LAYOUTS, WPS_SHAPES, WPS_THEMES, WPS_TRANSITIONS, WPS_ANIMATIONS, WPS_FONT_PAIRS, WPS_BLOCK_LIST, buildSmartBlock, WPS_ICONS, iconToDataUrl } from './presets.js'
import { inspectorHtml } from './inspector.js'
import { openSlideshow } from './presenter.js'
import { exportSceneToPptx, exportSceneToPdf, exportSlideToPng, exportSceneToPngZip } from './exporter.js'

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const opts = (items, key, label, selected) => items.map(i => `<option value="${esc(i[key])}" ${i[key] === selected ? 'selected' : ''}>${esc(i[label])}</option>`).join('')

export function mountEditor(deck, rpc) {
  const studio = document.getElementById('planStudio'), right = studio.querySelector('.ps-right')
  right.querySelector('.pe-shell')?.remove()
  right.querySelector('.pe-reopen')?.remove()
  const reopen = document.createElement('button'); reopen.className = 'pe-btn pe-reopen'; reopen.textContent = '编辑幻灯片'; reopen.onclick = () => studio.classList.add('pe-active'); right.querySelector('.ps-toolbar').append(reopen)
  let scene = compileDeckToScene(deck), index = 0, selected = new Set(), tab = '开始', view = 'page', scale = 0.5, editing = false, snapshot = null
  const undo = [], redo = []
  const shell = document.createElement('div'); shell.className = 'pe-shell'; right.append(shell); studio.classList.add('pe-active')
  shell.innerHTML = `<div class="pe-top"><button class="pe-btn" data-act="ai">✦ AI</button><input class="pe-doc-title" aria-label="文稿标题"><div class="pe-tabs"></div><div class="pe-top-right"><button class="pe-btn" data-act="undo">↶</button><button class="pe-btn" data-act="redo">↷</button><button class="pe-btn" data-act="close">返回</button></div></div><div class="pe-ribbon"></div><div class="pe-body"><aside class="pe-rail"><div class="pe-rail-add-row"><select class="pe-select pe-rail-add-main" data-field="layout">${opts(WPS_LAYOUTS,'k','name','blank')}</select><button class="pe-btn" data-act="addSlide">＋</button></div><div class="pe-rail-list"></div></aside><main class="pe-center"><div class="pe-viewport"></div><div class="pe-notes-drawer"><div class="pe-notes-head">演讲者备注</div><textarea class="pe-notes-area" aria-label="演讲者备注"></textarea></div></main><aside class="pe-inspector"></aside></div><div class="pe-status"><span class="pe-count"></span><div class="pe-status-views"><button class="pe-status-btn" data-view="page">画布</button><button class="pe-status-btn" data-view="grid">网格</button><button class="pe-status-btn" data-view="outline">大纲</button><button class="pe-status-btn" data-act="notes">备注</button><span>缩放</span><input type="range" data-field="zoom" min="25" max="120" value="50"><span class="pe-zoom-value"></span></div></div>`
  const q = s => shell.querySelector(s), slide = () => scene.slides[index], elements = () => slide().elements.filter(e => selected.has(e.id))
  const save = () => { undo.push(JSON.stringify(scene)); if (undo.length > 50) undo.shift(); redo.length = 0 }
  const change = fn => { save(); fn(); syncFolioNumbers(scene); render() }
  const renderStage = () => {
    const d=slideStageDimensions(scene), vp=q('.pe-viewport')
    if(view==='grid') {vp.innerHTML=`<div class="pe-grid-sorter">${scene.slides.map((s,i)=>`<div class="pe-grid-card ${i===index?'on':''}" data-go="${i}"><div class="pe-grid-card-th"><div style="transform:scale(.18);transform-origin:top left">${renderSlideStageHtml(scene,s)}</div></div><span data-no-i18n>${i+1}. ${esc(s.label)}</span></div>`).join('')}</div>`;return}
    if(view==='outline') {vp.innerHTML=`<div class="pe-outline-editor">${scene.slides.map((s,i)=>`<div class="pe-oe-card"><div class="pe-oe-head"><button class="pe-btn" data-go="${i}">${i+1}</button><input class="pe-oe-title" data-outline-label="${i}" value="${esc(s.label)}"></div>${s.elements.filter(e=>typeof e.text==='string' && e.text).map(e=>`<textarea class="pe-oe-body" data-outline-slide="${i}" data-outline-id="${esc(e.id)}">${esc(e.text)}</textarea>`).join('')}</div>`).join('')}</div>`;return}
    vp.innerHTML = `<div class="pe-stage-shell" style="width:${d.w*scale}px;height:${d.h*scale}px"><div style="transform:scale(${scale});transform-origin:top left">${renderSlideStageHtml(scene, slide(), {interactive:true,selectedIds:selected})}</div>${elements().length===1 && typeof elements()[0].text==='string' ? '<div class="pe-float-bar" style="left:0;top:-38px"><button class="ai" data-act="aiPolish">✦ 润色</button><button class="ai" data-act="aiShorten">精简</button><button class="ai" data-act="aiExpand">扩写</button></div>' : ''}</div>`
  }
  const render = () => {
    if (!scene.slides.length) return
    index = Math.max(0, Math.min(index,scene.slides.length-1)); q('.pe-doc-title').value = scene.title
    q('.pe-tabs').innerHTML = ['开始','插入','设计','切换','动画','放映与导出'].map(t => `<button class="pe-tab ${tab===t?'on':''}" data-tab="${t}">${t}</button>`).join('')
    const buttons = {
      '开始': '<button class="pe-btn" data-act="bold"><b>B</b></button><button class="pe-btn" data-act="italic"><i>I</i></button><button class="pe-btn" data-act="underline"><u>U</u></button><button class="pe-btn" data-act="bullet">• 列表</button><button class="pe-btn" data-act="delete">删除元素</button><button class="pe-btn" data-act="duplicate">复制页面</button><button class="pe-btn" data-act="hide">隐藏页面</button><button class="pe-btn" data-act="removeSlide">删除页面</button>',
      '插入': `<button class="pe-btn" data-act="text">文本框</button><select class="pe-select" data-field="shape">${opts(WPS_SHAPES,'id','name','rect')}</select><button class="pe-btn" data-act="shape">插入形状</button><button class="pe-btn" data-act="image">图片</button><input type="file" accept="image/*" hidden data-field="image"><button class="pe-btn" data-act="table">表格</button><button class="pe-btn" data-act="chart">图表</button><select class="pe-select" data-field="block">${opts(WPS_BLOCK_LIST,'id','name','')}</select><button class="pe-btn" data-act="block">版块</button><select class="pe-select" data-field="icon">${opts(WPS_ICONS,'id','name','')}</select><button class="pe-btn" data-act="icon">图标</button><button class="pe-btn" data-act="pageNumber">页码</button>`,
      '设计': `<select class="pe-select" data-field="theme">${opts(WPS_THEMES,'id','name',scene.theme.id)}</select><button class="pe-btn" data-act="theme">应用主题</button><select class="pe-select" data-field="ratio"><option ${scene.ratio==='16:9'?'selected':''}>16:9</option><option ${scene.ratio==='4:3'?'selected':''}>4:3</option></select>`,
      '切换': `<select class="pe-select" data-field="transition">${opts(WPS_TRANSITIONS,'id','name',slide().transition?.type)}</select>`,
      '动画': `<select class="pe-select" data-field="animation">${opts(WPS_ANIMATIONS,'id','name',elements()[0]?.animation?.type || 'none')}</select>`,
      '放映与导出': '<button class="pe-btn" data-act="show">从当前页放映</button><button class="pe-btn" data-act="speaker">演讲者视图</button><button class="pe-btn" data-act="pptx">导出 PPTX</button><button class="pe-btn" data-act="pdf">导出 PDF</button><button class="pe-btn" data-act="png">导出 PNG</button><button class="pe-btn" data-act="zip">导出 PNG ZIP</button><button class="pe-btn" data-act="aiNotes">✦ 生成备注</button>'
    }; q('.pe-ribbon').innerHTML = buttons[tab]
    q('.pe-rail-list').innerHTML = scene.slides.map((s,i) => `<div class="pe-thumb-item ${index===i?'on':''} ${s.hidden?'hidden-sld':''}" draggable="true" data-slide="${i}"><div class="pe-thumb-head"><b>${i+1}</b><span data-no-i18n class="pe-thumb-title">${esc(s.label)}</span></div><div class="pe-thumb-box"><div style="transform:scale(${172/slideStageDimensions(scene).w});transform-origin:top left">${renderSlideStageHtml(scene,s)}</div></div></div>`).join('')
    renderStage(); q('.pe-notes-area').value = slide().notes || ''; q('.pe-count').textContent = `${index+1} / ${scene.slides.length}`; q('.pe-zoom-value').textContent = `${Math.round(scale*100)}%`
    q('.pe-inspector').innerHTML = inspectorHtml(scene,slide(),elements()[0])
  }
  const paintSelection = () => {
    for(const node of q('.pe-viewport').querySelectorAll('.pe-el')) {
      node.classList.toggle('sel',selected.has(node.dataset.eid))
      node.querySelectorAll(':scope > .pe-hd, :scope > .pe-rot').forEach(x=>x.remove())
      if(selected.size===1 && selected.has(node.dataset.eid)) {
        node.insertAdjacentHTML('beforeend', '<span class="pe-rot" data-h="rot"></span>'+['nw','n','ne','e','se','s','sw','w'].map(dir=>`<span class="pe-hd pe-hd-${dir}" data-h="${dir}"></span>`).join(''))
      }
    }
    q('.pe-inspector').innerHTML=inspectorHtml(scene,slide(),elements()[0])
    const stage=q('.pe-stage-shell');stage?.querySelector('.pe-float-bar')?.remove();if(stage && elements().length===1 && typeof elements()[0].text==='string')stage.insertAdjacentHTML('beforeend','<div class="pe-float-bar" style="left:0;top:-38px"><button class="ai" data-act="aiPolish">✦ 润色</button><button class="ai" data-act="aiShorten">精简</button><button class="ai" data-act="aiExpand">扩写</button></div>')
  }
  const controller = {
    getCurrentSlide:slide, getEffectiveScale:()=>scale, getStageSize:()=>slideStageDimensions(scene), getSelectedElements:elements,
    isEditingText:()=>editing, commitInlineEdit:()=>document.activeElement?.blur(), hasFormatBrush:()=>false, applyFormatBrushTo:()=>{},
    selectElement:(id,multi)=>{ if (!multi && !selected.has(id)) selected.clear(); if(multi && selected.has(id)) selected.delete(id); else selected.add(id); paintSelection() },
    clearSelection:()=>{selected.clear(); paintSelection()}, selectInBox:b=>{selected=new Set(slide().elements.filter(e=>e.x < b.x+b.w && e.x+e.w>b.x && e.y<b.y+b.h && e.y+e.h>b.y).map(e=>e.id));render()},
    beforeTransform:()=>{snapshot=JSON.stringify(scene)}, discardTransformSnapshot:()=>{snapshot=null}, commitTransform:()=>{if(snapshot){undo.push(snapshot);if(undo.length>50)undo.shift();redo.length=0;snapshot=null}render()}, paintStageOnly:renderStage, onLiveGeometryChange:()=>{},
    startInlineTextEdit:(id,dom)=>{const e=slide().elements.find(x=>x.id===id); if(!e || !('text' in e))return; const node=dom.querySelector('[data-edit-text]') || dom.querySelector('.pe-txt-content') || dom.firstElementChild; if(!node)return; save(); editing=true; node.contentEditable='true'; node.focus(); node.addEventListener('blur',()=>{e.text=node.innerText;editing=false;render()},{once:true})},
    startTableCellEdit:(id,r,c,node)=>{const e=slide().elements.find(x=>x.id===id);if(!e?.rows?.[r])return;save();editing=true;node.contentEditable='true';node.focus();node.addEventListener('blur',()=>{e.rows[r][c]=node.innerText;editing=false;render()},{once:true})}
  }
  attachCanvasInteractions(q('.pe-viewport'),controller)
  shell.addEventListener('click', async ev => {
    const t=ev.target.closest('[data-tab],[data-slide],[data-act],[data-view],[data-go]'); if(!t)return
    if(t.dataset.view){view=t.dataset.view;render();return}
    if(t.dataset.go!=null){index=Number(t.dataset.go);view='page';selected.clear();render();return}
    if(t.dataset.tab){tab=t.dataset.tab;render();return} if(t.dataset.slide!=null){index=Number(t.dataset.slide);selected.clear();render();return}
    const act=t.dataset.act, el=elements()[0]
    try {
      if(act==='close'){studio.classList.remove('pe-active');return} if(act==='ai'){studio.classList.toggle('pe-ai-collapsed');return}
      if(act==='undo' && undo.length){redo.push(JSON.stringify(scene));scene=JSON.parse(undo.pop());selected.clear();render();return}
      if(act==='redo' && redo.length){undo.push(JSON.stringify(scene));scene=JSON.parse(redo.pop());selected.clear();render();return}
      if(act==='notes'){q('.pe-notes-drawer').hidden=!q('.pe-notes-drawer').hidden;return}
      if(act==='addSlide') change(()=>{scene.slides.splice(++index,0,createSlideFromLayout(q('[data-field=layout]').value,scene,index));selected.clear()})
      if(act==='duplicate') change(()=>{const copy=structuredClone(slide());copy.id=uid('sld');copy.elements.forEach(e=>e.id=uid());scene.slides.splice(++index,0,copy);selected.clear()})
      if(act==='removeSlide' && scene.slides.length>1) change(()=>{scene.slides.splice(index,1);selected.clear()})
      if(act==='hide') change(()=>slide().hidden=!slide().hidden)
      if(act==='delete' && selected.size) change(()=>{slide().elements=slide().elements.filter(e=>!selected.has(e.id));selected.clear()})
      if((act==='bold'||act==='italic'||act==='underline') && el) change(()=>{el.style ||= {};el.style[act]=!el.style[act]})
      if(act==='bullet' && el)change(()=>{el.style ||= {};el.style.bullet=el.style.bullet?'': 'disc'})
      if(act==='text') change(()=>{const e={id:uid(),type:'text',x:100,y:100,w:400,h:100,text:'双击编辑文字',style:{fontSize:30,color:scene.theme.ink}};slide().elements.push(e);selected=new Set([e.id])})
      if(act==='shape') change(()=>{const e={id:uid(),type:'shape',shape:q('[data-field=shape]').value,x:150,y:150,w:220,h:140,text:'',style:{fill:scene.theme.accent}};slide().elements.push(e);selected=new Set([e.id])})
      if(act==='image')q('[data-field=image]').click()
      if(act==='replaceImage')q('[data-field=replaceImage]').click()
      if(act==='backgroundImage')q('[data-field=backgroundImage]').click()
      if(act==='block') change(()=>{const list=buildSmartBlock(q('[data-field=block]').value,scene.theme);list.forEach(e=>{e.id=uid();slide().elements.push(e)});selected=new Set(list.map(e=>e.id))})
      if(act==='icon') change(()=>{const icon=WPS_ICONS.find(x=>x.id===q('[data-field=icon]').value);if(icon){const e={id:uid(),type:'image',x:160,y:160,w:100,h:100,src:iconToDataUrl(icon.path,scene.theme.accent),style:{radius:0}};slide().elements.push(e);selected=new Set([e.id])}})
      if(act==='pageNumber') change(()=>{const e={id:uid(),type:'text',x:1100,y:660,w:100,h:35,text:String(index+1),style:{fontSize:18,color:scene.theme.muted}};slide().elements.push(e);selected=new Set([e.id])})
      if((act==='front'||act==='back') && el) change(()=>{slide().elements=slide().elements.filter(x=>x!==el);if(act==='front')slide().elements.push(el);else slide().elements.unshift(el)})
      if(el?.type==='table' && act==='tableRow')change(()=>el.rows.push(Array(el.rows[0]?.length||1).fill('')))
      if(el?.type==='table' && act==='tableCol')change(()=>el.rows.forEach(r=>r.push('')))
      if(el?.type==='table' && act==='tableRemoveRow' && el.rows.length>1)change(()=>el.rows.pop())
      if(el?.type==='table' && act==='tableRemoveCol' && el.rows[0]?.length>1)change(()=>el.rows.forEach(r=>r.pop()))
      if(act==='fontPair'){const pair=WPS_FONT_PAIRS.find(x=>x.id===q('[data-field=fontPair]').value);if(pair)change(()=>{scene.theme.fontHeading=pair.heading;scene.theme.fontBody=pair.body;scene.slides.forEach(s=>s.elements.forEach(e=>{if(e.type==='text'||e.type==='shape'){e.style ||= {};e.style.fontFamily=e.role==='title'?pair.heading:pair.body}}))})}
      if(['aiText','aiPolish','aiShorten','aiExpand'].includes(act) && el && typeof el.text==='string'){const target=slide(), original=el.text, action=act==='aiText'?q('[data-field=aiAction]').value:({aiPolish:'polish',aiShorten:'shorten',aiExpand:'expand'})[act];const result=await rpc('deck.ai_assist',{action,text:original,slideIndex:index},30000);if(el.text!==original || !target.elements.includes(el) || !scene.slides.includes(target))throw Error('文字已发生变化，请重新操作');change(()=>el.text=result.text)}
      if(act==='aiNotes'){const target=slide(), original=target.notes;const result=await rpc('deck.ai_assist',{action:'speaker_notes',text:target.elements.filter(e=>e.text).map(e=>e.text).join('\n'),slideIndex:index},30000);if(target.notes!==original || !scene.slides.includes(target))throw Error('备注已变化，请重新生成');change(()=>target.notes=result.text)}
      if(act==='table'){const dimensions=prompt('输入行数和列数，例如 3,4','3,3');if(dimensions===null)return;const [r,c]=dimensions.split(/[,，x× ]+/).map(Number);if(!Number.isInteger(r)||!Number.isInteger(c)||r<1||c<1||r>20||c>12)throw Error('行数须为 1–20，列数须为 1–12');change(()=>{const e={id:uid(),type:'table',x:120,y:130,w:700,h:280,rows:Array.from({length:r},(_,i)=>Array.from({length:c},()=>i?'内容':'标题')),style:{fontSize:20}};slide().elements.push(e);selected=new Set([e.id])})}
      if(act==='chart') change(()=>{const e={id:uid(),type:'chart',x:120,y:100,w:650,h:400,chartType:'column',categories:['A','B','C'],series:[{name:'数据',values:[20,40,30]}]};slide().elements.push(e);selected=new Set([e.id])})
      if(act==='theme') {const theme=WPS_THEMES.find(x=>x.id===q('[data-field=theme]').value);if(theme)change(()=>applyThemeToSlides(scene,theme))}
      if(act==='show'||act==='speaker')openSlideshow(scene,{startIndex:index,speaker:act==='speaker'})
      if(act==='pptx')await exportSceneToPptx(scene);if(act==='pdf')await exportSceneToPdf(scene);if(act==='png')await exportSlideToPng(scene,index);if(act==='zip')await exportSceneToPngZip(scene)
    } catch(e){alert(e.message)}
  })
  shell.addEventListener('change',ev=>{
    const t=ev.target, el=elements()[0], f=t.dataset.field
    if(t.dataset.outlineLabel!=null)change(()=>scene.slides[Number(t.dataset.outlineLabel)].label=t.value)
    if(t.dataset.outlineSlide!=null){const target=scene.slides[Number(t.dataset.outlineSlide)].elements.find(e=>e.id===t.dataset.outlineId);if(target)change(()=>target.text=t.value)}
    if(t.dataset.prop && el){if(t.dataset.prop==='hyperlink' && t.value && !/^https?:\/\//i.test(t.value)){alert('超链接必须使用 http 或 https');render();return}change(()=>{let value=t.type==='number'?Number(t.value):t.value;if(['w','h'].includes(t.dataset.prop))value=Math.max(1,value);el[t.dataset.prop]=value})}
    if(t.dataset.theme)change(()=>applyThemeToSlides(scene,{...scene.theme,[t.dataset.theme]:t.value}))
    if(t.dataset.style && el)change(()=>{el.style ||= {};el.style[t.dataset.style]=t.type==='number'?Number(t.value):t.value})
    if(t.dataset.animation && el)change(()=>{el.animation ||= {type:'none',trigger:'onClick',durationMs:450};el.animation[t.dataset.animation]=t.type==='number'?Math.max(0,Number(t.value)):t.value})
    if(f==='zoom'){scale=Number(t.value)/100;render()}
    if(f==='ratio')change(()=>{const factor=t.value==='4:3'?0.75:4/3;if(t.value!==scene.ratio)scene.slides.forEach(s=>s.elements.forEach(e=>{e.x*=factor;e.w*=factor}));scene.ratio=t.value})
    if(f==='transition')change(()=>slide().transition={type:t.value,durationMs:450})
    if((f==='animation'||f==='inspectorAnimation') && el)change(()=>el.animation={...(el.animation||{trigger:'onClick',durationMs:450}),type:t.value})
    if(f==='switchLayout')change(()=>switchSlideLayout(slide(),t.value,scene,index))
    if(f==='backgroundType')change(()=>{slide().background ||= {};slide().background.type=t.value;if(t.value==='gradient')slide().background.gradient ||= {from:scene.theme.paper,to:scene.theme.accent,angle:135}})
    if(f==='backgroundColor')change(()=>{slide().background.color=t.value;if(slide().background.type==='gradient')slide().background.gradient.from=t.value;else slide().background.type='solid'})
    if(f==='backgroundTo')change(()=>{slide().background.type='gradient';slide().background.gradient={from:slide().background.color||scene.theme.paper,to:t.value,angle:135}})
    if(f==='pattern')change(()=>slide().background.pattern=t.value)
    if(f==='chartData' && el?.type==='chart'){
      try { const parsed=parseChartData(t.value); change(()=>{el.categories=parsed.categories;el.series=parsed.series.map((series,i)=>({...el.series?.[i],...series}))}) }
      catch(error){alert(error.message);render()}

    }
    if(['image','replaceImage','backgroundImage'].includes(f) && t.files[0]){
      const file=t.files[0], target=slide(), targetEl=el
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)){alert('请选择 PNG、JPEG 或 WebP 图片');return}
      const reader=new FileReader();reader.onload=()=>{if(!scene.slides.includes(target))return;change(()=>{if(f==='backgroundImage'){target.background ||= {};target.background.type='image';target.background.image=reader.result}else if(f==='replaceImage' && target.elements.includes(targetEl))targetEl.src=reader.result;else if(f==='image'){const e={id:uid(),type:'image',x:120,y:100,w:400,h:300,src:reader.result,style:{}};target.elements.push(e);selected=new Set([e.id])}})};reader.readAsDataURL(file)
    }
  })
  q('.pe-notes-area').addEventListener('change',e=>change(()=>slide().notes=e.target.value))
  q('.pe-doc-title').addEventListener('change',e=>change(()=>scene.title=e.target.value))
  let drag=-1; q('.pe-rail-list').addEventListener('dragstart',e=>{drag=Number(e.target.closest('[data-slide]')?.dataset.slide)});q('.pe-rail-list').addEventListener('dragover',e=>e.preventDefault());q('.pe-rail-list').addEventListener('drop',e=>{e.preventDefault();const target=e.target.closest('[data-slide]');if(target && drag>=0)change(()=>{const [s]=scene.slides.splice(drag,1);index=Number(target.dataset.slide);scene.slides.splice(index,0,s)});drag=-1})
  shell.addEventListener('keydown', ev => { if (ev.target.matches('input,textarea,select,[contenteditable=true]')) return; if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); shell.querySelector(`[data-act=${ev.shiftKey ? 'redo' : 'undo'}]`).click() } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && selected.size) { ev.preventDefault(); change(()=>{slide().elements=slide().elements.filter(e=>!selected.has(e.id));selected.clear()}) } })
  render()
  return { getScene:()=>scene, refresh:render, async reviseSelected(instruction) { const el = elements()[0]; if (!el || typeof el.text !== 'string') throw new Error('请先在画布中选择一个文字元素'); const action = /翻译.*英|译成英/.test(instruction) ? 'translate_en' : /翻译.*中|译成中/.test(instruction) ? 'translate_zh' : /缩|精简/.test(instruction) ? 'shorten' : /扩|补充/.test(instruction) ? 'expand' : 'polish'; const original = el.text; const result = await rpc('deck.ai_assist', { action, text: original, context: instruction, slideIndex: index }, 30000); if (el.text !== original || !slide().elements.includes(el)) throw new Error('文字已发生变化，请重新操作'); change(()=>el.text=result.text); return result.text } }
}
window.mountPptEditor = mountEditor
