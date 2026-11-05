// Long-form social storytelling examples: fictional concepts, not claims or live offers.
const concepts=[
 {id:'social-coast-journal',name:'沿海慢行 · 一日长篇',brand:'COAST / JOURNAL',category:'旅游生活',style:'coast',palette:['#DFEBE6','#243C40','#3C7F7C','#BCD3CC','#6F8983'],source:'saltwater', chapters:['启程','抵达','海岸','午后','归途','收藏'],
  pages:[
   ['把一天留给海岸','一份虚构的慢旅行灵感，从准备出发到看见傍晚的光。'],
   ['为什么去海边','不必赶完所有景点，让步行和停留成为这一天的主角。'],
   ['先决定节奏','为途中休息留出空白，不把时间表排得过满。'],
   ['确认出行条件','出发前核实天气、潮汐、交通与目的地开放情况。'],
   ['只带需要的东西','水、防晒、舒适的鞋和一件防风外套，按天气调整。'],
   ['清晨的第一段路','早点出发，把交通衔接和意外变化算进行程。'],
   ['抵达之后先停一停','找到安全的公共区域，看看地图，也感受一下风向。'],
   ['沿着岸边慢慢走','选择开放且安全的步道，不进入封闭区域或危险岸线。'],
   ['把目光放低','脚下的石头、潮水留下的痕迹，都是海岸的一部分。'],
   ['在转角看见远处','不必急着拍下全部风景，先用自己的眼睛看看。'],
   ['一段有风的路','沿途观察地形与路况，遇到强风或湿滑地面及时调整。'],
   ['留意当地规则','遵循现场指示，不采集受保护的动植物或自然物。'],
   ['为午餐留出时间','优先选择适合自己口味与预算的当地餐饮。'],
   ['一张靠窗的桌子','让午餐变成停下来的理由，而不仅是行程里的空隙。'],
   ['补充水分与能量','根据行程长短准备饮水和适量食物，注意垃圾带走。'],
   ['午后的海岸线','光线慢慢改变，沿着安全路线继续探索。'],
   ['寻找可以坐下的地方','选择允许停留的公共空间，给身体一点休息。'],
   ['把手机放下一会儿','听听海浪和周围的声音，留下不被屏幕占满的时间。'],
   ['记录一处细节','一张照片、一句笔记，足够留下属于自己的记忆。'],
   ['尊重正在生活的人','拍摄他人前征得同意，不妨碍居民和工作人员。'],
   ['等一等傍晚的光','日落时间会随地点和季节变化，事先确认返程安排。'],
   ['给归途留余量','查看末班交通与替代路线，不要把最后一程留给运气。'],
   ['再看一次海','离开前回头看看，也检查有没有留下随身物品。'],
   ['一份简单的回顾','今天最喜欢哪一段路？哪一次停留值得下次再来？'],
   ['慢旅行不是固定路线','有人喜欢长距离步行，也有人只想坐着看水面。'],
   ['把旅程分享给朋友','分享自己的感受，同时明确这是一份灵感而非实时指南。'],
   ['下一次可以换个季节','同一处海岸在不同天气与时节里，会呈现不同的面貌。'],
   ['保存你的出行清单','天气、交通、补给、安全和返程，是出发前的五个检查点。'],
   ['路线选择因人而异','根据同行者体力、无障碍需求和现场条件调整安排。'],
   ['遇到不确定就折返','实际安全比完成计划更重要；关注当地官方提示。'],
   ['旅行中的小片刻','风、光线与一段闲谈，往往比打卡数量更值得记住。'],
   ['让自然保持原样','遵守当地环保规定，把带来的物品和垃圾一起带走。'],
   ['把经验留给下一次','记下喜欢的时间、舒适的距离和需要改进的准备。'],
   ['你想怎样度过一天','选择一种适合自己的慢节奏，给旅程留一点弹性。'],
   ['收藏这份灵感','规划真实出行前，请再次核实地点、开放时间与安全信息。'],
   ['下一站，慢一点','保存这组卡片，分享给想一起去海边的人。行动引导为示例。'] ]},
 {id:'social-bakery-story',name:'一间面包房的早晨',brand:'MORNING / CRUMB',category:'餐饮美食',style:'bakery',palette:['#F4DED0','#54342B','#B45C45','#E9BCAB','#956F60'],source:'sugar', chapters:['清晨','面团','烤炉','柜台','相聚','收尾'],
  pages:[
   ['从一炉面包开始','虚构面包房的一天，从面团、烤炉到邻里相聚。'],
   ['天亮之前','当街道还安静，工作台上的一天已经开始。'],
   ['先把空间准备好','整理台面、工具和食材，让每一步都有清晰的位置。'],
   ['从基础食材出发','面粉、水和时间，是许多面包故事的起点。'],
   ['每一种材料都有角色','不同配方需要不同处理方式，实际制作以专业配方为准。'],
   ['双手认识面团','观察质地的变化，比单纯追求某个画面更重要。'],
   ['揉面是一个过程','根据配方调整操作，让面团逐渐形成需要的状态。'],
   ['给面团一些时间','温度、配方和环境会影响发酵，实际时间应现场判断。'],
   ['在等待中准备下一步','整理工具、检查配料，也为下一炉安排好空间。'],
   ['整形，慢慢来','轻柔地处理面团，让每一份都保持自己的形状。'],
   ['细节从手上开始','一个折叠、一点撒粉，都是制作过程里的小动作。'],
   ['烤炉升温','遵守设备安全要求，按照实际配方设定温度与时间。'],
   ['第一炉进入烤箱','等待香气出现，也注意观察颜色和熟度变化。'],
   ['出炉后的片刻','让成品在合适的环境中冷却，再进行后续处理。'],
   ['面包的表面','颜色、形状和纹理让每一炉都拥有自己的表情。'],
   ['柜台慢慢热闹起来','将产品介绍清楚，让客人知道自己正在选择什么。'],
   ['把食材写明白','实际销售时，应准确标注配料与过敏原信息。'],
   ['今天想吃什么','有人选择一片面包，有人想带一份点心回家。'],
   ['一杯饮品，一点时间','面包房也可以是一个短暂停留和交流的地方。'],
   ['一份给自己，一份分享','好的食物经常从一个人手里，走到另一个人的餐桌。'],
   ['看看柜台背后','每一份成品都连接着准备、制作和收拾的工作。'],
   ['让季节参与菜单','按实际供应与制作能力调整产品，不虚构食材来源。'],
   ['为不同需求留心','提供真实的产品信息，并避免未经证实的饮食或健康承诺。'],
   ['忙碌之后整理工作台','清洁与储存是制作流程的一部分，应遵循当地食品安全要求。'],
   ['记录今天的经验','记下配方调整、使用情况和下一次可以改进的地方。'],
   ['手作的意义','重复不是机械复制，而是在每一次操作中持续观察。'],
   ['一间有温度的店','让客人感到被欢迎，也让工作的人有舒服的节奏。'],
   ['让好东西被看见','用真实照片与清楚的说明，展示产品和制作过程。'],
   ['故事不只在成品里','面粉、工具和手上的动作，也值得被认真记录。'],
   ['分享一个日常习惯','从第一杯饮品到最后一次收拾，平凡的细节构成一天。'],
   ['再看一眼工作台','忙碌的痕迹提醒我们，一份面包背后有许多人的付出。'],
   ['为明天留好准备','根据真实需求计划材料，减少不必要的浪费。'],
   ['给邻里的一封便条','感谢每一次来访、每一句问候和每一份信任。'],
   ['这一炉的故事','从清晨的面团，到傍晚被分享的一餐，日常值得被珍惜。'],
   ['想了解更多？','菜单、营业时间、地址及预订信息请替换为真实资料。'],
   ['明天，柜台见','收藏这个故事，分享给也喜欢烘焙和好食物的人。行动引导为示例。'] ]},
 {id:'social-green-studio',name:'共生工作室 · 品牌长篇',brand:'COMMON / CANOPY',category:'品牌宣传',style:'green',palette:['#DCE4CA','#243B2A','#637D43','#BFCFA8','#6E8064'],source:'canopy', chapters:['起点','理念','方法','实践','日常','邀请'],
  pages:[
   ['把自然带回日常','一个虚构品牌故事，讲述空间、材料与共同生活的可能。'],
   ['一切从一个问题开始','我们能否让工作和生活的场所，更愿意接纳自然？'],
   ['先观察，再设计','从人们如何使用一个空间出发，而不是先决定它看起来怎样。'],
   ['让光和空气进入','在设计条件允许的情况下，关注舒适的光线与通风体验。'],
   ['植物不只是装饰','照顾方式、使用环境和长期维护同样值得被考虑。'],
   ['走进工作室','一个供人交流、观察和共同尝试的概念空间。'],
   ['关于我们的愿景','让自然、工作与相处之间建立更温和的连接。'],
   ['从小处开始','一次桌面整理、一盆合适的植物，都可以成为改变的起点。'],
   ['选择适合的材料','在真实项目中核实来源、耐用性和维护条件。'],
   ['留下可使用的空间','舒适不是堆满物品，而是让人能够自由活动和停留。'],
   ['一张共享的桌子','空间的意义，来自人们在其中发生的合作和对话。'],
   ['倾听不同的需求','让使用者参与讨论，理解不同工作方式和身体需求。'],
   ['把复杂问题拆开','先明确目标、限制和使用场景，再探索可行的方案。'],
   ['先做一个小实验','用低成本的试验收集反馈，再决定是否扩大应用。'],
   ['接受变化与调整','空间会随着使用者改变，设计也应该保留适应能力。'],
   ['近距离看材料','颜色、触感和实际维护需求，共同影响长期体验。'],
   ['把照顾纳入计划','明确谁负责维护、需要什么资源，以及如何持续检查。'],
   ['更少，但更合适','做出适合场景的选择，不以数量代替质量。'],
   ['记录过程中的问题','写下有效和无效的尝试，为下一次讨论提供依据。'],
   ['让成果可以被理解','用清晰的文字、图片和真实资料讲述设计背后的决定。'],
   ['一个日常的早晨','人们进入空间，开始工作，也照看身边的植物。'],
   ['午后的共同时间','一场讨论、一杯水，都是场所被使用的真实时刻。'],
   ['给安静留个位置','不同任务需要不同环境，让专注和交流都能发生。'],
   ['欢迎新的想法','开放反馈渠道，让使用者参与空间的持续改善。'],
   ['不把理念说得太满','关于环保和材料的公开表述，应提供依据并说明边界。'],
   ['把视觉和价值放在一起','一致的色彩与文字可以帮助品牌讲清楚自己的方法。'],
   ['从局部看整体','一张桌子、一束光和一段路径，都是整体体验的一部分。'],
   ['空间也需要时间','在真实使用中观察变化，而不是只记录完成的那一天。'],
   ['向合作伙伴学习','把不同专业的经验带进来，让讨论更具体。'],
   ['为下一个阶段提问','哪些地方被频繁使用？哪些地方还需要重新理解？'],
   ['让经验继续流动','用案例和笔记分享过程，也诚实说明限制与不足。'],
   ['一个持续的品牌故事','品牌不是一句口号，而是反复做出的具体选择。'],
   ['给读者一个参与方式','邀请分享感受、关注后续故事或了解真实项目。'],
   ['把灵感带到自己的空间','从一个能照顾到的小细节开始，按实际条件调整。'],
   ['谢谢你走到这里','这套内容是概念演示，发布前请替换品牌资料和事实依据。'],
   ['一起创造更好的日常','收藏这组故事，分享给关心空间与自然的人。行动引导为示例。'] ]}
]
const imagePages=[0,2,5,7,10,12,15,17,20,22,25,27,30,32,35]
const layoutAt=(i)=>i===0?'cover':i===35?'ending':imagePages.includes(i)?'picture':['essay','statement','number','split','essay'][i%5]
export const makeLongCases = (concepts) => concepts.map(c=>{
 const [paper,ink,accent,second,muted]=c.palette
 return {id:c.id,name:c.name,en:c.brand,by:'DesignBuddy',cat:'轮播',fmt:'card',ratio:'4:5 · 竖版',date:20261104,kind:c.category,category:c.category,tags:['社交轮播',c.category,'长篇','品牌故事','小红书','Instagram'],desc:c.language==='en'?'A 36-card editorial carousel in six chapters, with original English copy and a closing call to action.':`${c.category}长篇社交轮播：36 张卡片按六个章节展开，包含视觉故事、观点与结尾引导。`,bestFor:c.language==='en'?[c.categoryLabel,'Long-form storytelling','Brand content','Social media']:[c.category,'长篇社交叙事','品牌内容','视觉故事'],visual:`${c.brand} · ${paper} / ${accent} · ${c.style} 独立风格`,how:c.language==='en'?'Thirty-six cards across six chapters, combining photography, editorial typography, key ideas and a sample call to action. This is a fictional concept; verify and replace claims before publishing.':'36 页按六个章节展开，每页独立文案，交替使用图文、观点、数字和编辑式版面。内容为虚构示例，发布前请核实替换。',styles:c.palette.slice(0,3),colorway:`${paper} · ${accent}`,footLeft:c.brand,paper,ink,accent,second,muted,rule:second,body:ink,display:'sans',folio:false,socialLong:{brand:c.brand,style:c.style,chapters:c.chapters,language:c.language || 'zh',categoryLabel:c.categoryLabel || c.category},slides:c.pages.map(([title,lead],i)=>({k:'social-long',kind:layoutAt(i),label:title,title,lead,chapter:c.chapters[Math.floor(i/6)],...(imagePages.includes(i)?{img:String(imagePages.indexOf(i)+1).padStart(2,'0')}:{})}))}
})
export const SOCIAL_LONG_CASES=makeLongCases(concepts)
const esc = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function renderSocialLong(deck,slide,index=0){
 const n=index+1, total=deck.slides.length, d=deck.socialLong, english=d.language==='en'
 const image=slide.img?`<div class="long-image"><img src="cases/${esc(deck.id)}/${esc(slide.img)}.jpg" alt="" loading="lazy"></div>`:''
 const header=`<div class="long-top"><b>${esc(d.brand)}</b><span>${esc(slide.chapter)} / ${String(n).padStart(2,'0')} — ${String(total).padStart(2,'0')}</span></div>`
 const footer=`<div class="long-footer"><span>${esc(d.categoryLabel)} · ${esc(slide.chapter)}</span><span>${n<total?(english?'SWIPE FOR MORE →':'继续滑动 →'):(english?'END · SAVE & SHARE':'完 · 收藏分享')}</span></div>`
 const progress=`<div class="long-progress">${deck.slides.map((_,i)=>`<i${i<n?' class="on"':''}></i>`).join('')}</div>`
 const kicker=`<div class="long-kicker">${String(Math.floor(index/6)+1).padStart(2,'0')} / ${esc(slide.chapter)}</div>`
 let content
 if(slide.kind==='cover') content=`<div class="long-cover">${image}<div class="long-cover-copy">${kicker}<h1>${esc(slide.title)}</h1><p>${esc(slide.lead)}</p><div class="long-action">${english?'EXPLORE THE STORY ↗':'探索故事 ↗'}</div></div></div>`
 else if(slide.kind==='picture') content=`<div class="long-picture">${image}<div class="long-picture-copy">${kicker}<h2>${esc(slide.title)}</h2><p>${esc(slide.lead)}</p></div></div>`
 else if(slide.kind==='ending') content=`<div class="long-ending">${image}<div class="long-ending-copy">${kicker}<h2>${esc(slide.title)}</h2><p>${esc(slide.lead)}</p><div class="long-action">${english?'SAVE · SHARE ↗':'收藏 · 分享 ↗'}</div><small>${english?'DEMO CTA · REPLACE WITH A REAL LINK':'行动引导示例 · 请替换为真实链接'}</small></div></div>`
 else if(slide.kind==='statement') content=`<div class="long-statement">${kicker}<div class="long-quote">“</div><h2>${esc(slide.title)}</h2><p>${esc(slide.lead)}</p><div class="long-rule">${esc(d.brand)} <span>STORY / ${String(n).padStart(2,'0')}</span></div></div>`
 else if(slide.kind==='number') content=`<div class="long-number">${kicker}<div class="long-big">${String(n).padStart(2,'0')}</div><h2>${esc(slide.title)}</h2><p>${esc(slide.lead)}</p><div class="long-rule">A STORY IN SIX CHAPTERS <span>${esc(slide.chapter)}</span></div></div>`
 else if(slide.kind==='split') content=`<div class="long-split">${kicker}<div class="long-split-body"><div><span>FIELD NOTE</span><b>${String(n).padStart(2,'0')}</b></div><div><h2>${esc(slide.title)}</h2><p>${esc(slide.lead)}</p></div></div><div class="long-rule">${esc(slide.chapter)} <span>KEEP GOING ↗</span></div></div>`
 else content=`<div class="long-essay">${kicker}<div class="long-essay-label">${esc(d.brand)}<br>STORY NOTES / ${String(n).padStart(2,'0')}</div><h2>${esc(slide.title)}</h2><p>${esc(slide.lead)}</p><div class="long-rule">ONE THOUGHT AT A TIME <span>→</span></div></div>`
 return `<div class="long-social ${english?'long-en ':''}long-${esc(d.style)} long-page-${esc(slide.kind)}">${content}${header}${progress}${footer}</div>`
}
