import { FIFTY_IMAGE_SERIES_CASES } from './image-series-fifty.js'
import { ARTIFACT_PROFILES } from './artifact-profiles.js'
// Interactive local prototypes. Estimates are illustrative; no orders or bookings are sent.
const families=[
 {kind:'Creative studio',suffix:'Studio Planner',unit:'pieces',option:'Making approach',choices:[['Small batch',12],['Studio edition',20],['Custom finish',32]],base:45,note:'A fictional production estimate, not a product quote.'},
 {kind:'Urban planning',suffix:'Place Planner',unit:'sessions',option:'Engagement format',choices:[['Site walk',18],['Design session',35],['Community series',55]],base:60,note:'A fictional engagement estimate, not a development proposal.'},
 {kind:'Bakery operations',suffix:'Bake Planner',unit:'batches',option:'Bake plan',choices:[['Daily bake',8],['Sharing box',16],['Event selection',28]],base:25,note:'A fictional baking estimate; not a menu, order or food safety plan.'},
 {kind:'Travel planning',suffix:'Trip Planner',unit:'travellers',option:'Trip style',choices:[['Coast walk',10],['Day outing',22],['Guided visit',35]],base:20,note:'A fictional planning estimate; not transport, weather or safety advice.'},
 {kind:'Outdoor planning',suffix:'Field Planner',unit:'participants',option:'Field format',choices:[['Short walk',5],['Observation day',14],['Group session',24]],base:15,note:'A fictional field estimate; always check current local safety guidance.'},
 {kind:'Technology planning',suffix:'Systems Planner',unit:'instances',option:'Sample tier',choices:[['Essential',15],['Team',30],['Extended',50]],base:40,note:'A fictional capacity estimate; not a quote or claim about a live service.'},
 {kind:'Hospitality planning',suffix:'Table Planner',unit:'guests',option:'Gathering format',choices:[['Small table',12],['Shared meal',24],['Group event',40]],base:30,note:'A fictional hospitality estimate; no menu, reservation or payment is created.'},
 {kind:'Coffee planning',suffix:'Coffee Planner',unit:'servings',option:'Service format',choices:[['Counter service',4],['Tasting',8],['Group session',15]],base:12,note:'A fictional service estimate; not an order, menu or dietary statement.'},
 {kind:'Product configurator',suffix:'Cycle Planner',unit:'builds',option:'Build style',choices:[['Everyday',35],['Touring',60],['Workshop',95]],base:120,note:'A fictional configuration estimate; not a quote or technical riding advice.'},
 {kind:'Broadcast planning',suffix:'Programme Planner',unit:'sessions',option:'Session format',choices:[['Studio session',15],['Interview',28],['Community show',45]],base:40,note:'A fictional production estimate; no broadcast, booking or licence is created.'}
]
// The five shell variants use different DOM hierarchy and navigational structures.
// Within each, ten family treatments and fifty distinct palettes/briefs establish identity.
function paletteFor(index) {
 const hue=(index*137+19)%360, variant=index%5, dark=variant===1
 return {paper:`hsl(${hue} ${dark?35:45}% ${dark?14:variant===3?85:variant===4?78:91}%)`,ink:dark?'#F5F4EF':'#202A2D',accent:`hsl(${hue} ${dark?70:58}% ${dark?75:29}%)`,second:`hsl(${hue} ${dark?26:30}% ${dark?25:variant===4?68:82}%)`,muted:dark?'#CED6D6':'#536367'}
}
export const ARTIFACT_CASES=FIFTY_IMAGE_SERIES_CASES.map((source,index)=>{
 const group=Math.floor(index/5),variant=index%5,family=families[group],profile=ARTIFACT_PROFILES[index],palette=paletteFor(index)
 const name=`${profile.brand} · ${family.suffix}`
 return {...source,...palette,body:palette.ink,rule:palette.second,styles:[palette.paper,palette.accent,palette.ink],colorway:`${palette.paper} · ${palette.accent}`,id:`artifact-live-${String(index+1).padStart(2,'0')}`,name,en:profile.brand,cat:'实时产物',fmt:'artifact',ratio:'1280×860 · interactive tool',kind:family.kind,category:source.category,tags:['artifact','interactive','English',family.kind,source.category],desc:`${profile.purpose} A fictional interactive prototype with 36 connected screens, 15 local photographs and a live illustrative estimate.`,bestFor:[family.kind,profile.option,'Interactive planning','Local prototype demonstrations'],visual:`${profile.brand} · ${['Workspace','Side index','Planning ledger','Editorial masthead','Visual board'][variant]} · ${palette.paper}`,how:`${profile.purpose} Select a ${profile.option.toLowerCase()}, adjust ${profile.unit}, pin views and explore a local estimate. All figures are illustrative; no payment or reservation is made.`,artifactLive:{...family,...profile,style:`live-${group}`,family:group,variant,shell:['workspace','index','ledger','editorial','visual'][variant]},slides:source.slides.map((s,i)=>{
 const section=s.title.split(' · ')[0],kind=['overview','options','detail','planner','board','review'][i%6],prefix=['Discover','Choose','Explore','Estimate','Collect','Review'][i%6]
 return {...s,k:'artifact-live',kind,title:`${prefix}: ${section}`,lead:i%6===0?`${profile.purpose} ${s.lead}`:s.lead}
 })}
})
const states=new Map()
function stateFor(deck){if(!states.has(deck.id))states.set(deck.id,{choice:0,quantity:1,pins:[],notice:''});return states.get(deck.id)}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const ctl=(label,action,value='',cls='')=>`<span role="button" tabindex="0" class="art-control ${cls}" data-art-action="${esc(action)}" data-value="${esc(value)}">${esc(label)}</span>`
export function renderArtifactCase(deck,slide,index=0){
 const cfg=deck.artifactLive,st=stateFor(deck),total=(cfg.base+cfg.choices[st.choice][1])*st.quantity,pinned=st.pins.includes(index),n=index+1
 const image=`<div class="art-photo"><img src="cases/${esc(deck.id)}/${esc(slide.img)}.jpg" alt="" loading="lazy"></div>`
 const optionButtons=cfg.choices.map(([label,rate],i)=>ctl(`${label} · +$${rate}`,'choice',i,`art-option ${i===st.choice?'on':''}`)).join('')
 const stepper=`<div class="art-stepper">${ctl('−','quantity',-1,'art-step')}<b aria-live="polite">${st.quantity}</b>${ctl('+','quantity',1,'art-step')}<span>${esc(cfg.unit)}</span></div>`
 const summary=`<div class="art-summary"><div><span>BASE / ${esc(cfg.unit.toUpperCase())}</span><b>$${cfg.base}</b></div><div><span>${esc(cfg.option.toUpperCase())}</span><b>+$${cfg.choices[st.choice][1]}</b></div><div><span>QUANTITY</span><b>${st.quantity}</b></div><div class="art-total"><span>ILLUSTRATIVE TOTAL</span><strong aria-live="polite">$${total.toLocaleString('en-US')}</strong></div><small>${esc(cfg.note)}</small></div>`
 const actionBar=`<div class="art-actions">${ctl(pinned?'♥ Pinned':'♡ Pin this view','pin',index,'art-button secondary')}${ctl('View next','go',Math.min(index+1,35),'art-button primary')}${ctl('Reset demo','reset','','art-button ghost')}</div><div class="art-notice" role="status">${esc(st.notice)}</div>`
 const topic=`<div class="art-eyebrow">${esc(slide.chapter)} / VIEW ${String(n).padStart(2,'0')}</div><h1>${esc(slide.title)}</h1><p>${esc(slide.lead)}</p>`
 let body
 if(slide.kind==='overview') {
  const metrics=`<div class="art-inline-metric"><div><b>36</b><span>CONNECTED VIEWS</span></div><div><b>15</b><span>LOCAL IMAGES</span></div><div><b>${st.pins.length}</b><span>PINNED VIEWS</span></div></div>`
  if(cfg.variant===0) body=`<div class="art-overview"><div class="art-overview-copy">${topic}${metrics}${actionBar}</div>${image}</div>`
  else if(cfg.variant===1) body=`<div class="art-overview art-overview-poster">${image}<div class="art-poster-copy">${topic}${actionBar}</div><div class="art-poster-meter">${metrics}</div></div>`
  else if(cfg.variant===2) body=`<div class="art-overview art-overview-report"><div class="art-report-heading"><span>PROJECT BRIEF / 01</span>${topic}</div><div class="art-report-grid">${image}<div><div class="art-label">CURRENT PLAN</div><h2>${esc(cfg.choices[st.choice][0])}</h2>${metrics}${actionBar}</div></div></div>`
  else if(cfg.variant===3) body=`<div class="art-overview art-overview-editorial"><div class="art-editorial-lead"><span>${esc(cfg.kind)} / ISSUE 01</span>${topic}</div><div class="art-editorial-photo">${image}<div>${metrics}${actionBar}</div></div></div>`
  else body=`<div class="art-overview art-overview-canvas"><div class="art-canvas-label">${esc(cfg.brand.toUpperCase())} / PROJECT BOARD</div><div class="art-canvas-grid"><div>${topic}${actionBar}</div>${image}</div>${metrics}</div>`
 }
 else if(slide.kind==='options') body=`<div class="art-work"><div class="art-work-image">${image}<div class="art-image-caption">${esc(cfg.kind)} / VISUAL REFERENCE</div></div><div class="art-work-copy">${topic}<div class="art-label">${esc(cfg.option)}</div><div class="art-options">${optionButtons}</div>${stepper}${actionBar}</div></div>`
 else if(slide.kind==='detail') body=`<div class="art-detail"><div>${topic}<div class="art-detail-box"><div class="art-label">CURRENT FORMAT</div><b>${esc(cfg.choices[st.choice][0])}</b><p>${esc(cfg.note)}</p>${ctl('Explore options','go',index-1,'art-button secondary')}</div>${actionBar}</div>${image}</div>`
 else if(slide.kind==='planner') body=`<div class="art-planner"><div class="art-planner-main">${topic}<div class="art-label">${esc(cfg.option)}</div><div class="art-options">${optionButtons}</div><div class="art-label">QUANTITY</div>${stepper}${actionBar}</div><aside>${image}${summary}</aside></div>`
 else if(slide.kind==='board') { const links=st.pins.length?st.pins.slice(0,5):[Math.max(0,index-4),Math.max(0,index-3),Math.max(0,index-2)]; body=`<div class="art-board"><div>${topic}<div class="art-label">${st.pins.length?'YOUR PINNED VIEWS':'SUGGESTED VIEWS'}</div><div class="art-board-list">${links.map(i=>ctl(`${String(i+1).padStart(2,'0')}  ${deck.slides[i].chapter}`,'go',i,'art-board-link')).join('')}</div>${actionBar}</div><aside>${image}${summary}</aside></div>` }
 else body=`<div class="art-review"><div>${topic}<div class="art-review-callout"><span>LOCAL DEMONSTRATION</span><b>${esc(cfg.choices[st.choice][0])} · ${st.quantity} ${esc(cfg.unit)}</b><p>Nothing is submitted or purchased. Change the controls to explore the live calculation.</p></div>${ctl('Confirm demo','confirm','','art-button primary')}${actionBar}</div><aside>${image}${summary}</aside></div>`
 const chapterLinks=deck.slides.filter((_,i)=>i%6===0).map((s,i)=>ctl(s.chapter,'go',i*6,`art-nav-link ${Math.floor(index/6)===i?'active':''}`)).join('')
 const brand=`<div class="art-brand" role="button" tabindex="0" data-art-action="go" data-value="0">${esc(cfg.brand)}<i>✳</i></div>`
 const end=`<footer class="art-footer"><span>FICTIONAL INTERACTIVE PROTOTYPE · NO LIVE TRANSACTION</span><span>${ctl('← Previous','go',Math.max(0,index-1),'art-footer-link')} ${String(n).padStart(2,'0')} / ${deck.slides.length} ${ctl('Next →','go',Math.min(index+1,35),'art-footer-link')}</span></footer>`
 const root=`art-live art-${esc(cfg.style)} art-variant-${cfg.variant}`
 if(cfg.shell==='index') return `<div class="${root} art-shell-index"><aside class="art-index-sidebar">${brand}<div class="art-index-intro"><b>${esc(cfg.kind)}</b><span>PROJECT DIRECTORY / 01</span></div><nav>${chapterLinks}</nav><div class="art-index-end">${ctl(`Pinned ${st.pins.length}`,'go',4,'art-header-link')}<small>LOCAL DEMO / NO TRANSACTION</small></div></aside><div class="art-index-main"><div class="art-index-top"><span>${esc(cfg.option)} / ${esc(cfg.unit)}</span><span>VIEW ${String(n).padStart(2,'0')} / ${deck.slides.length}</span></div><div class="art-shell-main"><main>${body}</main></div>${end}</div></div>`
 if(cfg.shell==='ledger')return `<div class="${root} art-shell-ledger"><div class="art-ledger-strip"><span>INTERACTIVE PLANNING / ${esc(cfg.kind.toUpperCase())}</span><span>ESTIMATES ARE ILLUSTRATIVE</span></div><header>${brand}<nav>${chapterLinks}</nav>${ctl(`Pinned ${st.pins.length}`,'go',4,'art-header-link')}</header><div class="art-shell-main"><main>${body}</main><aside class="art-ledger-side"><span>DEMO / ${String(n).padStart(2,'0')}</span><b>$${total.toLocaleString('en-US')}</b><small>CURRENT ESTIMATE</small>${ctl('View planner','go',3,'art-button secondary')}<div>NOT A LIVE<br>TRANSACTION</div></aside></div>${end}</div>`
 if(cfg.shell==='editorial')return `<div class="${root} art-shell-editorial"><div class="art-editorial-ribbon">AN INDEPENDENT ${esc(cfg.kind.toUpperCase())} CONCEPT <span>LOCAL INTERACTIVE DEMO</span></div><header><div class="art-edition">PROJECT JOURNAL<br>ISSUE ${String(cfg.family+1).padStart(2,'0')}</div>${brand}<div class="art-edition-actions">${ctl(`Pinned ${st.pins.length}`,'go',4,'art-header-link')}</div></header><nav class="art-editorial-nav">${chapterLinks}</nav><div class="art-shell-main"><main>${body}</main></div>${end}</div>`
 if(cfg.shell==='visual')return `<div class="${root} art-shell-visual"><aside class="art-visual-sidebar"><div class="art-visual-backdrop"><img src="cases/${esc(deck.id)}/${esc(slide.img)}.jpg" alt="" loading="lazy"></div><div class="art-visual-sidebar-content">${brand}<div class="art-visual-index">${esc(cfg.kind)}<br>PROJECT / ${String(n).padStart(2,'0')}</div><nav>${chapterLinks}</nav><div class="art-visual-bottom">${ctl(`Pinned ${st.pins.length}`,'go',4,'art-header-link')}<small>FICTIONAL PROJECT · LOCAL DEMO</small></div></div></aside><div class="art-index-main"><div class="art-index-top"><span>${esc(cfg.brand.toUpperCase())} / ${esc(cfg.option.toUpperCase())}</span><span>SCREEN ${String(n).padStart(2,'0')}</span></div><div class="art-shell-main"><main>${body}</main></div>${end}</div></div>`
 return `<div class="${root} art-shell-workspace"><header>${brand}<nav>${chapterLinks}</nav>${ctl(`Pinned ${st.pins.length}`,'go',4,'art-header-link')}</header><div class="art-workspace-strip"><span>${esc(cfg.kind.toUpperCase())} / LOCAL DEMO</span><span>${esc(cfg.option.toUpperCase())} · ${esc(cfg.choices[st.choice][0].toUpperCase())}</span><span>VIEW ${String(n).padStart(2,'0')} / ${deck.slides.length}</span></div><div class="art-shell-main"><main>${body}</main></div>${end}</div>`
}
export function handleArtifactAction(deck,index,action,value){
 if(!deck?.artifactLive)return null
 const st=stateFor(deck),v=Number(value)
 if(action==='go') return {navigate:Math.max(0,Math.min(deck.slides.length-1,Number.isFinite(v)?v:0))}
 if(action==='choice'&&Number.isInteger(v)&&v>=0&&v<deck.artifactLive.choices.length){st.choice=v;st.notice=`Selected ${deck.artifactLive.choices[v][0]} for this local demo.`}
 else if(action==='quantity'&&(v===1||v===-1)){st.quantity=Math.min(99,Math.max(1,st.quantity+v));st.notice='Illustrative estimate updated.'}
 else if(action==='pin'&&Number.isInteger(v)&&v>=0&&v<deck.slides.length){st.pins=st.pins.includes(v)?st.pins.filter(x=>x!==v):[...st.pins,v];st.notice=st.pins.includes(v)?'View pinned locally.':'View removed from pins.'}
 else if(action==='reset'){st.choice=0;st.quantity=1;st.pins=[];st.notice='Demo reset; no information was sent.'}
 else if(action==='confirm'){st.notice='Demo confirmed locally. No transaction, booking or message was sent.'}
 else return null
 return {refresh:true}
}
