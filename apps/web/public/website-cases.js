import { MORE_SITE_DEFINITIONS } from './website-cases-more.js'
import { DISTINCT_SITE_DEFINITIONS } from './website-cases-distinct.js'
import { NEW_SITE_DEFINITIONS } from './website-cases-new.js'
import { LATEST_SITE_DEFINITIONS } from './website-cases-latest.js'
import { COLLECTION_SITE_DEFINITIONS } from './website-cases-collection.js'
// Locally backed website prototypes. Every route is an in-app
// screen, not an external link; checkout and booking are explicitly demos.
const definitions = [
  {
    id:'atelier-site', name:'Stillwater Atelier', domain:'stillwater.studio', source:'stillwater',
    theme:['#F3F0E8','#303A32','#536C57','#E4E7D9','#797E71','#D7D9CE','#4B554B'], style:'atelier',
    intro:'Hand-shaped objects for the everyday table.', description:'A ceramic studio and shop: browse collections, inspect objects, save favourites, book a workshop and try a local checkout flow.',
    nav:[['Shop',1],['Studio',12],['Journal',17],['Workshops',21],['Visit',26]],
    items:[['Moon cup','Stoneware · ash glaze',38,'02'],['Still bowl','Porcelain · celadon',54,'03'],['Morning pitcher','Stoneware · moss',72,'01'],['Low serving plate','Porcelain · chalk',62,'08'],['Tea ritual set','Stoneware · sage',118,'09'],['Studio vase','Stoneware · salt',86,'12']],
    screens:[
      ['Home','home','Made slowly, used daily','Objects for a quieter table, shaped and finished by hand.'],
      ['All objects','catalog','Objects for the everyday','Explore cups, bowls and small rituals made in our studio.'],
      ['Cups','catalog','A good cup, every day','Small shapes designed to feel right in the hand.'],
      ['Bowls','catalog','Bowls for gathering','From a morning meal to a table shared with friends.'],
      ['Tableware','catalog','The table, considered','Simple forms and glazes meant to be used together.'],
      ['Moon cup','detail','Moon cup','A light, tactile cup with an ash glaze and a comfortable rim.'],
      ['Still bowl','detail','Still bowl','A generous bowl with a soft celadon surface.'],
      ['Morning pitcher','detail','Morning pitcher','A pouring vessel for flowers, water or the breakfast table.'],
      ['Low serving plate','detail','Low serving plate','A gently raised edge makes this an everyday serving piece.'],
      ['Tea ritual set','detail','Tea ritual set','A small set of objects for slowing down over tea.'],
      ['Studio vase','detail','Studio vase','A sculptural vessel made in small batches.'],
      ['Materials & care','faq','Made to be lived with','Care for your ceramics and understand how each glaze develops.'],
      ['Our studio','story','A studio by the water','Meet the people and place behind our collection.'],
      ['Our process','story','From clay to kiln','Follow the material from the first sketch to the final firing.'],
      ['Glaze library','gallery','A palette from the landscape','Explore the surfaces, textures and colours we return to.'],
      ['Meet the makers','story','Hands behind the work','Our small team shares the making and the decisions.'],
      ['Sustainability','story','Less, made better','Small batches and durable materials help us make thoughtfully.'],
      ['Journal','gallery','Notes from the studio','Conversations, practical guides and things we are learning.'],
      ['The morning table','story','The morning table','A simple ritual of tea, light and a handmade cup.'],
      ['A glaze in the making','story','A glaze in the making','How colour and texture change through a firing.'],
      ['Clay and place','story','Clay and place','On finding inspiration in the landscape around us.'],
      ['Workshops','gallery','Make something with us','Small-group sessions for curious hands and all levels.'],
      ['Hand-building class','booking','An introduction to clay','Choose a date and party size for a hand-building session.'],
      ['Wheel throwing','booking','At the wheel','Try a guided session at the pottery wheel.'],
      ['Private workshops','booking','Gather around clay','Plan a small private session with friends or colleagues.'],
      ['Gift cards','detail','Give time to make','A thoughtful gift for someone who likes to make things.'],
      ['Visit','story','Come by the studio','Find us, explore the collection and say hello.'],
      ['Basket','cart','Your basket','Review the objects you have chosen in this local demo.'],
      ['Checkout','checkout','Nearly yours','Review the demonstration order before confirming.'],
      ['Order confirmation','confirmation','Thank you for visiting','This is a prototype confirmation; no order or payment is sent.'],
    ],
  },
  {
    id:'table-site', name:'Terracotta Table', domain:'terracotta.table', source:'terracotta',
    theme:['#F8F2E8','#302016','#A64A2A','#EFE1CF','#897563','#DDC9B6','#5E493A'], style:'table',
    intro:'A neighbourhood table, open to everyone.', description:'A restaurant experience with a filterable menu, dish details, reservation flow, local favourites and a simulated order.',
    nav:[['Menu',1],['Our story',12],['Journal',17],['Reservations',21],['Visit',26]],
    items:[['Tomato & basil','Garden tomatoes · herbs',14,'05'],['Wood-fired bread','Cultured butter · sea salt',9,'02'],['Market vegetables','Seasonal greens · lemon',17,'01'],['Slow Sunday supper','Sharing plate · for two',42,'06'],['Olive oil cake','Citrus · cream',12,'09'],['House preserves','Seasonal fruit · toast',11,'11']],
    screens:[
      ['Home','home','There is room at our table','A neighbourhood kitchen celebrating good ingredients and good company.'],
      ['The menu','catalog','Made for sharing','Explore the dishes and ingredients on our seasonal menu.'],
      ['Small plates','catalog','Start with something small','Vegetables, bread and bright flavours for the table.'],
      ['Mains','catalog','From the kitchen','Comforting plates cooked with the seasons.'],
      ['Desserts','catalog','Something sweet','A little something to finish a long lunch.'],
      ['Tomato & basil','detail','Tomato & basil','Garden tomatoes, herbs and a generous pour of olive oil.'],
      ['Wood-fired bread','detail','Wood-fired bread','Warm bread, cultured butter and a little sea salt.'],
      ['Market vegetables','detail','Market vegetables','Seasonal greens, prepared simply with lemon.'],
      ['Sunday supper','detail','Slow Sunday supper','A sharing plate made for a slower meal together.'],
      ['Olive oil cake','detail','Olive oil cake','A soft cake with citrus and cream.'],
      ['House preserves','detail','House preserves','Seasonal fruit, prepared in the kitchen.'],
      ['Dietary information','faq','A table for everyone','Read about ingredients and common dietary questions.'],
      ['Our kitchen','story','A neighbourhood kitchen','A small team, a warm room and an open kitchen.'],
      ['Our ingredients','story','Good food starts nearby','Meet the produce and people behind the menu.'],
      ['Inside the restaurant','gallery','A place to linger','Step inside the dining room and the kitchen.'],
      ['Meet the team','story','The people at the table','The cooks, hosts and makers who make the room feel alive.'],
      ['Our approach','story','Cook with the season','A short menu that changes with what is good today.'],
      ['Journal','gallery','Stories from the table','Recipes, conversations and notes from our kitchen.'],
      ['The perfect tomato','story','The perfect tomato','A few simple ways to celebrate the season.'],
      ['Bread every morning','story','Bread every morning','A look at the daily ritual of baking.'],
      ['At the market','story','A morning at the market','Following the ingredients from the market to our table.'],
      ['Reservations','booking','Pull up a chair','Choose your date, time and party size in this demo.'],
      ['Lunch reservation','booking','Lunch at the table','Plan a relaxed midday meal.'],
      ['Dinner reservation','booking','Dinner at the table','Find a time for an evening together.'],
      ['Private dining','booking','A table of your own','Plan a gathering for a larger group.'],
      ['Gift cards','detail','Share a seat at the table','Give someone the promise of a meal together.'],
      ['Visit','story','Find our table','Visit the restaurant and discover the neighbourhood.'],
      ['Your selection','cart','Your selection','Review your sample menu selection.'],
      ['Review','checkout','Review your selection','Confirm your sample selection in this prototype.'],
      ['Confirmation','confirmation','See you at the table','This prototype does not send a reservation or payment.'],
    ],
  },
  {
    id:'harbour-site', name:'Harbour Passage', domain:'harbourpassage.co', source:'saltwater',
    theme:['#EEF2F0','#102C37','#226A75','#D8E5E3','#6B8284','#C6D6D3','#37545A'], style:'harbour',
    intro:'A slower way across the water.', description:'A coastal ferry concept: compare routes, explore destinations, choose a departure and step through a transparent demo booking.',
    nav:[['Routes',1],['Our fleet',12],['Field notes',17],['Plan a trip',21],['Visit',26]],
    items:[['Harbour crossing','A short passage · one way',12,'02'],['Island day trip','A day on the water',28,'01'],['Evening crossing','Golden hour · one way',16,'06'],['Family crossing','Two adults · two children',38,'04'],['Return passage','Flexible return · same day',22,'05'],['Coastal explorer','Scenic route · return',34,'09']],
    screens:[
      ['Home','home','The journey is part of the day','A thoughtful way to move between harbour, coast and islands.'],
      ['All routes','catalog','Find your way across','Compare crossings and explore the coast at your own pace.'],
      ['Harbour routes','catalog','Across the harbour','Short crossings connecting the waterfront.'],
      ['Island routes','catalog','Out to the islands','Take the scenic way to a quieter shore.'],
      ['Scenic routes','catalog','Take the long way','More time on the water and a different view of the coast.'],
      ['Harbour crossing','detail','Harbour crossing','A short passage across the water, with room to breathe.'],
      ['Island day trip','detail','Island day trip','A return trip with time to explore the island.'],
      ['Evening crossing','detail','Evening crossing','Watch the coastline change in the evening light.'],
      ['Family crossing','detail','Family crossing','A simple passage for a small family group.'],
      ['Return passage','detail','Return passage','Travel out and back on the same day.'],
      ['Coastal explorer','detail','Coastal explorer','Follow the shoreline on a scenic return route.'],
      ['Travel information','faq','Before you sail','What to know about boarding, accessibility and luggage.'],
      ['Our fleet','story','Built for the crossing','Meet the boats and the people who care for them.'],
      ['Our crew','story','People of the harbour','The team that makes every crossing possible.'],
      ['The vessels','gallery','Life on board','A closer look at the spaces, decks and views.'],
      ['Our history','story','A harbour tradition','The story of a connection across the water.'],
      ['Our approach','story','Respect the water','How a good journey can begin with care for its surroundings.'],
      ['Field notes','gallery','Stories from the coast','Journeys, local places and conversations from the water.'],
      ['A morning crossing','story','A morning crossing','A quiet start and the first boat of the day.'],
      ['Island guide','story','A day on the island','A few ideas for taking your time on shore.'],
      ['The working harbour','story','The working harbour','A closer look at the everyday life of the waterfront.'],
      ['Plan a trip','booking','Plan your crossing','Choose a date, departure and passenger count in this demo.'],
      ['Morning departure','booking','The first crossing','Plan a morning journey across the harbour.'],
      ['Afternoon departure','booking','An afternoon on the water','Choose an afternoon departure and travel at your own pace.'],
      ['Group travel','booking','Travel together','Plan a crossing for friends or a small group.'],
      ['Travel gift card','detail','Give a little distance','A gift for someone who loves the water.'],
      ['Find the harbour','story','Meet us at the water','Find the departure point and prepare to board.'],
      ['Your trip','cart','Your trip','Review the sample passages you have selected.'],
      ['Review booking','checkout','Review your booking','Confirm the details of your demonstration booking.'],
      ['Confirmation','confirmation','See you on the water','This prototype does not issue tickets or charge a payment.'],
    ],
  },
]

export const SITE_CASES = [...definitions, ...MORE_SITE_DEFINITIONS, ...DISTINCT_SITE_DEFINITIONS, ...NEW_SITE_DEFINITIONS, ...LATEST_SITE_DEFINITIONS, ...COLLECTION_SITE_DEFINITIONS].map(d => {
  const [paper,ink,accent,second,muted,rule,body]=d.theme
  return {id:d.id,name:d.name,en:d.intro,by:'DesignBuddy',cat:'网站',fmt:'site',ratio:'1440×900 · 16:10',date:20261104,kind:'Site recreation',category:'案例演示',tags:['website','interactive','prototype'],desc:d.description,bestFor:['Website recreation','Interactive prototyping','Visual design','User journeys'],visual:`${d.style} · ${paper} · ${accent}`,how:'30 connected prototype screens, with 15 local photographs, navigable routes, searchable collections, selections, quantities and simulated booking or checkout. No real payment or reservation is made.',styles:[paper,ink,accent],colorway:`${d.style} · ${accent}`,folio:false,footLeft:d.name,paper,ink,accent,second,muted,rule,body,display:'sans',siteConfig:{domain:d.domain,style:d.style,shell:d.shell,nav:d.nav,categories:d.categories,tool:d.tool,items:[...d.items,d.gift || [d.id==='harbour-site'?'Travel gift card':'Gift card','A gift for someone special',50,'11']]},slides:d.screens.map(([label,kind,title,lead],i)=>({k:'replica-page',label,kind,title,lead,path:i===0?'/':'/'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-'),img:String(i%15+1).padStart(2,'0'),item:i>=5&&i<=10?i-5:i===25?6:0}))}
})

const states = new Map()
function stateFor(deck) {
  if (!states.has(deck.id)) states.set(deck.id, {basket:[], favorites:[], qty:1, filter:'all', query:'', date:'', time:'10:00', guests:2, notice:'', openFaq:-1})
  return states.get(deck.id)
}
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const ctl=(label,action,value='',cls='')=>`<span role="button" tabindex="0" class="rc-button ${cls}" data-rc="${action}" data-value="${escape(value)}">${escape(label)}</span>`
const photo=(deck,img,go,cls='')=>`<span role="button" tabindex="0" aria-label="Explore related page" class="rc-photo ${cls}" data-rc="go" data-value="${go}"><img src="cases/${escape(deck.id)}/${escape(img)}.jpg" alt="" loading="lazy"></span>`
const itemCard=(deck,item,i)=>`<div class="rc-card">${photo(deck,item[3],i===6?25:5+i)}<div class="rc-card-info"><div><strong>${escape(item[0])}</strong><small>${escape(item[1])}</small></div><b>$${item[2]}</b></div>${ctl('View details','go',i===6?25:5+i,'rc-link')}</div>`
export function renderSiteCase(deck, slide, index) {
  const st=stateFor(deck), config=deck.siteConfig, items=config.items, item=items[slide.item||0]
  const nav=config.nav.map(([label,target])=>ctl(label,'go',target,'rc-navlink')).join('')
  const details=slide.kind==='detail'
  let content=''
  if(slide.kind==='home') {
    const image=photo(deck,slide.img,1,'rc-hero-image')
    const actions=`<div class="rc-actions">${ctl(config.nav[0][0],'go',1,'primary')}${ctl(config.nav[3][0],'go',21,'outline')}</div>`
    if(config.shell==='archive') content=`<div class="rc-home-archive"><div class="rc-archive-index">COLLECTION / 001 <span>AN INDEPENDENT ARCHIVE OF MAKING</span></div><div class="rc-archive-hero"><div><div class="rc-eyebrow">OPEN THE COLLECTION</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}</div>${image}</div><div class="rc-archive-label"><b>OBJECTS / DOCUMENTS / STORIES</b><span>THE INDEX · EST. FOR THE CURIOUS</span></div></div>`
    else if(config.shell==='maker') content=`<div class="rc-home-maker"><div class="rc-maker-intro"><span>THE WORKSHOP / NO. 01</span><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}</div><div class="rc-maker-feature">${image}<div><b>GOOD WORK<br>TAKES TIME.</b><span>TOOLS, MATERIALS<br>AND THE PEOPLE BEHIND THEM</span></div></div></div>`
    else if(config.shell==='urban') content=`<div class="rc-home-urban"><div class="rc-urban-line"><span>FIELD GUIDE / ISSUE 01</span><span>NEIGHBOURHOOD SCALE ↗</span></div><div class="rc-urban-hero"><div><div class="rc-eyebrow">A MORE COMFORTABLE CITY</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}</div>${image}</div><div class="rc-urban-legend"><span>● SHADE</span><span>■ COMMUNITY</span><span>▲ STREETS</span><b>IDEAS FOR EVERYDAY LIFE</b></div></div>`
    else if(config.shell==='freight') content=`<div class="rc-home-freight"><div class="rc-freight-ticket"><span>NETWORK / OVERVIEW</span><span>01 — 06 / SERVICES</span><span>YOUR NEXT MOVE ↗</span></div><div class="rc-freight-hero"><div><div class="rc-eyebrow">A MORE CONSIDERED NETWORK</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}</div>${image}</div><div class="rc-freight-stats"><div><b>01</b> TRANSPORT</div><div><b>02</b> STORAGE</div><div><b>03</b> PLANNING</div><div>LOCAL DEMONSTRATION / NO LIVE DATA</div></div></div>`
    else if(config.shell==='listening') content=`<div class="rc-home-listening"><div class="rc-listening-topline">FIELD RECORDINGS <span>AN URBAN LISTENING PROJECT / 001</span></div><div class="rc-listening-hero">${image}<div><div class="rc-eyebrow">THE CITY, IN DETAIL</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}</div></div><div class="rc-listening-note"><span>LISTEN / OBSERVE / SHARE</span><span>STORIES FROM THE FIELD ↗</span></div></div>`
    else if(config.shell==='living') content=`<div class="rc-home-living"><div class="rc-living-kicker">PLACES FOR PEOPLE <span>VOL. 01 / THE NEIGHBOURHOOD</span></div><div class="rc-living-hero"><div><div class="rc-eyebrow">A DIFFERENT KIND OF HOME</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}</div>${image}</div><div class="rc-living-caption">SHARED SPACE, SHARED STORIES <span>MEET THE NEIGHBOURHOOD ↗</span></div></div>`
    else if(config.shell==='campus') content=`<div class="rc-home-campus"><div class="rc-campus-label">AN OPEN INSTITUTE FOR LEARNING <span>EST. FOR THE CURIOUS ↗</span></div><div class="rc-campus-title"><div><div class="rc-eyebrow">LEARN / THINK / CONNECT</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}</div>${image}</div><div class="rc-campus-note"><b>01 — A different kind of classroom</b><span>Explore ideas, together.</span></div></div>`
    else if(config.shell==='field') content=`<div class="rc-home-field"><div class="rc-field-kicker">FIELD STATION <span>COASTAL OBSERVATIONS / 01</span></div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}<div class="rc-field-feature">${image}<div><span>FIELD NOTE 001</span><b>Look closer.<br>Stay curious.</b><p>An invitation to notice the world at the waterline.</p>${ctl('Explore fieldwork ↗','go',1,'rc-link')}</div></div></div>`
    else if(config.shell==='bazaar') content=`<div class="rc-home-bazaar"><div class="rc-bazaar-intro"><div><div class="rc-eyebrow">YOUR NEIGHBOURHOOD, ALL TOGETHER</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}</div><div class="rc-bazaar-round">GOOD FOOD<br>GOOD PEOPLE<br>GOOD DAYS ✳</div></div><div class="rc-bazaar-image">${image}<div>THE MARKET IS A MEETING PLACE <span>COME ON IN ↗</span></div></div></div>`
    else if(config.shell==='rail') content=`<div class="rc-home-pulse"><div class="rc-pulse-top"><span>CREATIVE ENERGY / VOL. 01</span><span>SCROLL TO EXPLORE ↓</span></div><h1>${escape(slide.title)}</h1><div class="rc-pulse-grid">${image}<div><div class="rc-eyebrow">THE ENERGY IS YOURS</div><p>${escape(slide.lead)}</p>${actions}<div class="rc-pulse-stamp">P / 01</div></div></div></div>`
    else if(config.shell==='console') content=`<div class="rc-home-signal"><div class="rc-signal-overline"><span>PLATFORM / OVERVIEW</span><span>● SYSTEM DEMO</span></div><div class="rc-signal-grid"><div><div class="rc-eyebrow">SYSTEMS FOR PEOPLE</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}<div class="rc-signal-metrics"><div><b>01</b><small>PLATFORM</small></div><div><b>06</b><small>SERVICES</small></div><div><b>∞</b><small>IDEAS</small></div></div></div>${image}</div></div>`
    else if(config.shell==='masthead') content=`<div class="rc-home-crumb"><div class="rc-crumb-note">FRESH FROM THE OVEN · MADE WITH CARE</div><div class="rc-crumb-hero">${image}<div class="rc-crumb-card"><div class="rc-eyebrow">A NEIGHBOURHOOD BAKERY</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}</div></div><div class="rc-crumb-bottom"><span>GOOD FOOD, GOOD COMPANY</span><span>EXPLORE THE COUNTER →</span></div></div>`
    else content=`<div class="rc-hero"><div class="rc-hero-copy"><div class="rc-eyebrow">INDEPENDENT · THOUGHTFULLY MADE</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${actions}<div class="rc-hero-meta">${escape(deck.intro || deck.en)} <span>01 / 30</span></div></div>${image}</div>`
  }
  else if(slide.kind==='gallery') {
    const links = index===14 ? [15,16,13] : index===17 ? [18,19,20] : [22,23,24]
    content=`<div class="rc-gallery-hero">${photo(deck,slide.img,links[0],'rc-gallery-cover')}<div><div class="rc-eyebrow">EXPLORE / ${escape(slide.label)}</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p></div></div><div class="rc-gallery-links">${links.map(i=>`<div>${photo(deck,deck.slides[i].img,i,'rc-gallery-image')}<div class="rc-card-info"><strong>${escape(deck.slides[i].title)}</strong></div>${ctl('Explore →','go',i,'rc-link')}</div>`).join('')}</div>`
  } else if(slide.kind==='catalog') {
    const available = index === 2 ? [0,2] : index === 3 ? [1,3] : index === 4 ? [4,5] : items.map((_,i)=>i)
    const shown=items.map((it,i)=>({it,i})).filter(({it,i})=>available.includes(i) && (st.filter==='all'||(st.filter==='first'?i<3:st.filter==='saved'?st.favorites.includes(i):i>=3)) && it[0].toLowerCase().includes(st.query.toLowerCase()))
    content=`<div class="rc-heading"><div><div class="rc-eyebrow">EXPLORE / ${escape(slide.label)}</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p></div><div class="rc-count">${shown.length} results</div></div><div class="rc-filterbar">${ctl('All','filter','all',st.filter==='all'?'active':'')}${ctl(config.categories?.[0] || 'Collection 01','filter','first',st.filter==='first'?'active':'')}${ctl(config.categories?.[1] || 'Collection 02','filter','second',st.filter==='second'?'active':'')}${ctl('Saved','filter','saved',st.filter==='saved'?'active':'')}<input class="rc-search" data-rc-input="query" aria-label="Search collection" placeholder="Search collection" value="${escape(st.query)}">${ctl('Search','search','','outline')}</div><div class="rc-grid">${shown.length?shown.map(({it,i})=>itemCard(deck,it,i)).join(''):'<div class="rc-empty">No matching items. Try another search.</div>'}</div>`
  } else if(details) {
    const i=slide.item||0
    content=`<div class="rc-detail">${photo(deck,item[3],14,'rc-detail-image')}<div class="rc-detail-copy"><div class="rc-eyebrow">${escape(config.nav[0][0])} / ${escape(slide.label)}</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p><div class="rc-price">${'$'+item[2]} <small>Demo price</small></div><div class="rc-rule"></div><div class="rc-label">QUANTITY</div><div class="rc-stepper">${ctl('−','qty','-1')}<strong>${st.qty}</strong>${ctl('+','qty','1')}</div><div class="rc-actions">${ctl('Add to selection','add',i,'primary')}${ctl(st.favorites.includes(i)?'♥ Saved':'♡ Save','favorite',i,'outline')}</div><div class="rc-fine">${escape(st.notice || 'Prototype only · no real order or payment')}</div>${ctl('View selection →','go',27,'rc-link')}</div></div>`
  } else if(slide.kind==='booking') {
    content=`<div class="rc-split">${photo(deck,slide.img,14,'rc-split-image')}<div class="rc-form-panel"><div class="rc-eyebrow">PLAN YOUR VISIT · DEMO</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p><label>Date<input type="date" data-rc-input="date" value="${escape(st.date)}"></label><label>Time<select data-rc-input="time">${['10:00','12:00','14:00','16:00'].map(t=>`<option ${st.time===t?'selected':''}>${t}</option>`).join('')}</select></label><label>Guests / passengers<select data-rc-input="guests">${[1,2,3,4,5,6].map(n=>`<option ${st.guests===n?'selected':''}>${n}</option>`).join('')}</select></label>${ctl('Review date','book','','primary')}<div class="rc-fine" role="status">${escape(st.notice || 'This is a prototype; no real reservation is made.')}</div></div></div>`
  } else if(slide.kind==='calculator' && config.tool) {
    const tool=config.tool, quantity=st.toolQty ?? tool.quantity, rate=st.toolRate ?? tool.rate
    const result=st.toolResult == null ? '—' : '$'+st.toolResult.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
    content=`<div class="rc-split">${photo(deck,slide.img,14,'rc-split-image')}<div class="rc-form-panel"><div class="rc-eyebrow">INTERACTIVE ESTIMATE · DEMO</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p><label>${escape(tool.label)}<input type="number" min="0" max="1000000" step="1" data-rc-input="toolQty" value="${escape(quantity)}"></label><label>${escape(tool.rateLabel)}<input type="number" min="0" max="1000000" step="0.01" data-rc-input="toolRate" value="${escape(rate)}"></label>${ctl('Calculate estimate','calculate','','primary')}<div class="rc-estimate" role="status"><span>Estimated total</span><strong>${escape(result)}</strong><small>${escape(st.notice || tool.disclaimer)}</small></div></div></div>`
  } else if(slide.kind==='cart'||slide.kind==='checkout') {
    const sum=st.basket.reduce((n,row)=>n+items[row.i][2]*row.qty,0)
    content=`<div class="rc-heading"><div><div class="rc-eyebrow">YOUR SELECTION · DEMO</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p></div></div><div class="rc-cart"><div>${st.basket.length?st.basket.map(row=>`<div class="rc-cart-row">${photo(deck,items[row.i][3],row.i===6?25:5+row.i,'rc-cart-image')}<div><strong>${escape(items[row.i][0])}</strong><small>${escape(items[row.i][1])}</small><div class="rc-stepper">${ctl('−','cart-minus',row.i)}<b>${row.qty}</b>${ctl('+','cart-plus',row.i)}${ctl('Remove','remove',row.i,'rc-link')}</div></div><b>$${items[row.i][2]*row.qty}</b></div>`).join(''):`<div class="rc-empty">Your selection is empty. ${ctl('Explore the collection','go',1,'rc-link')}</div>`}</div><aside class="rc-summary"><div class="rc-eyebrow">ORDER SUMMARY</div><div class="rc-summary-line"><span>Subtotal</span><b>$${sum}</b></div><div class="rc-summary-line"><span>Total</span><strong>$${sum}</strong></div>${slide.kind==='cart'?ctl('Review selection','go',28,'primary'):ctl('Confirm demo','confirm','','primary')}<p>No payment is collected. This is an interactive design prototype.</p><div role="status" class="rc-fine">${escape(st.notice)}</div></aside></div>`
  } else if(slide.kind==='faq') {
    const faq=[['How does this work?','Explore the screens and try the interactive controls. This is a prototype, not a live service.'],['Can I change my selection?','Yes. Open your selection to adjust quantities or remove an item.'],['Is a booking or payment real?','No. Dates, selections and confirmations stay in this browser session only.'],['Where can I learn more?','Explore the story and visit pages using the navigation above.']]
    content=`<div class="rc-heading"><div><div class="rc-eyebrow">HELP & INFORMATION</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p></div></div><div class="rc-faq">${faq.map(([q,a],i)=>`<div class="rc-faq-row">${ctl(q,'faq',i,'rc-faq-question')}<span>${st.openFaq===i?'−':'+'}</span>${st.openFaq===i?`<p>${escape(a)}</p>`:''}</div>`).join('')}</div>`
  } else if(slide.kind==='confirmation') content=`<div class="rc-confirm">${photo(deck,slide.img,1,'rc-confirm-img')}<div><div class="rc-eyebrow">DEMONSTRATION COMPLETE</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p>${ctl('Return home','go',0,'primary')}</div></div>`
  else content=`<div class="rc-story"><div><div class="rc-eyebrow">${escape(slide.label)} / ${String(index+1).padStart(2,'0')}</div><h1>${escape(slide.title)}</h1><p>${escape(slide.lead)}</p><p class="rc-story-body">${escape(deck.en)} Discover the details, people and places behind this independent concept.</p><div class="rc-actions">${ctl('Explore more','go',index===26?21:Math.min(26,index+1),'primary')}${ctl('View collection','go',1,'outline')}</div></div>${photo(deck,slide.img,14,'rc-story-image')}</div>`
  const count=st.basket.reduce((n,row)=>n+row.qty,0)
  const brand=`<div class="rc-brand" role="button" tabindex="0" data-rc="go" data-value="0">${escape(deck.name)}<i>✳</i></div>`
  const countLinks=`${ctl('Saved '+st.favorites.length,'saved','','rc-navlink')}${ctl('Selection '+count,'go',27,'rc-navlink')}`
  const footer=`<div class="rc-footer"><span>${escape(deck.name)} · INTERACTIVE PROTOTYPE</span><span>${ctl('Previous','previous','','rc-link')} ${String(index+1).padStart(2,'0')} / ${deck.slides.length} ${ctl('Next','next','','rc-link')}</span><span>LOCAL DEMO · NO LIVE TRANSACTIONS</span></div>`
  const address=`<div class="rc-browser"><span>● &nbsp;● &nbsp;●</span><span>${escape(config.domain)}${escape(slide.path)}</span><span>↗</span></div>`
  if(config.shell==='archive') return `<div class="rc rc-${escape(config.style)} rc-frame-archive" data-nw="site"><div class="rc-archive-strip">A PLACE TO LOOK CLOSER <span>INDEPENDENT ARCHIVE / DEMONSTRATION</span></div><header class="rc-archive-header">${brand}<div class="rc-archive-header-note">COLLECTING<br>MAKING & MEMORY</div><div class="rc-archive-header-counts">${countLinks}</div></header><nav class="rc-archive-nav"><span>CATALOGUE INDEX →</span>${nav}</nav><div class="rc-content">${content}</div>${footer}</div>`
  if(config.shell==='maker') return `<div class="rc rc-${escape(config.style)} rc-frame-maker" data-nw="site"><header class="rc-maker-header">${brand}<nav>${nav}</nav><div>${countLinks}</div></header><div class="rc-maker-layout"><div class="rc-content">${content}</div><aside class="rc-maker-side"><span>THE PRACTICE OF<br>MAKING WELL</span>${photo(deck,'03',14,'rc-maker-side-image')}<div>FROM THE WORKBENCH<br><b>AN INDEPENDENT WORKSHOP</b></div>${ctl('Explore the workshop ↗','go',12,'rc-link')}</aside></div>${footer}</div>`
  if(config.shell==='urban') return `<div class="rc rc-${escape(config.style)} rc-frame-urban" data-nw="site"><div class="rc-urban-band"><span>C / C</span><b>FIELD GUIDE</b><small>LOCAL DEMO</small></div><div class="rc-urban-main"><header class="rc-urban-header">${brand}<div>DESIGNING FOR<br>EVERYDAY COMFORT</div><div class="rc-urban-counts">${countLinks}</div></header><div class="rc-urban-nav"><span>EXPLORE BY TOPIC /</span><nav>${nav}</nav></div><div class="rc-content">${content}</div>${footer}</div></div>`
  if(config.shell==='freight') return `<div class="rc rc-${escape(config.style)} rc-frame-freight" data-nw="site"><header class="rc-freight-header">${brand}<span>NETWORK SERVICES<br><b>LOCAL DEMO / 001</b></span><div>${countLinks}</div></header><nav class="rc-freight-nav"><span>MANIFEST /</span>${nav}</nav><div class="rc-freight-main"><div class="rc-freight-marker"><b>${String(index+1).padStart(2,'0')}</b><span>SCREEN<br>INDEX</span></div><div class="rc-content">${content}</div></div>${footer}</div>`
  if(config.shell==='listening') return `<div class="rc rc-${escape(config.style)} rc-frame-listening" data-nw="site"><header class="rc-listening-header">${brand}<span>INDEPENDENT LISTENING PROJECT · LOCAL DEMO</span><div>${countLinks}</div></header><div class="rc-listening-layout"><aside class="rc-listening-index"><div>THE INDEX / 05</div><nav>${nav}</nav><span>TAKE A MOMENT<br>TO LISTEN.</span></aside><div class="rc-content">${content}</div><aside class="rc-listening-side"><span>ISSUE</span><b>01</b><i>✳</i><small>AN OPEN INVITATION TO PAY ATTENTION</small></aside></div>${footer}</div>`
  if(config.shell==='living') return `<div class="rc rc-${escape(config.style)} rc-frame-living" data-nw="site"><aside class="rc-living-column">${brand}<div class="rc-living-column-title">A LITTLE<br>MORE ROOM<br>FOR LIFE.</div><div class="rc-living-column-nav"><span>EXPLORE THE PROJECT</span><nav>${nav}</nav></div><div class="rc-living-column-bottom">INDEPENDENT NEIGHBOURHOOD PROJECT<br>LOCAL INTERACTIVE DEMO</div></aside><div class="rc-living-main"><header class="rc-living-header"><span>COMMON SPACES / SHARED STORIES</span><div>${countLinks}</div></header><div class="rc-content">${content}</div>${footer}</div></div>`
  if(config.shell==='campus') return `<div class="rc rc-${escape(config.style)} rc-frame-campus" data-nw="site"><header class="rc-campus-header">${brand}<div>AN INDEPENDENT LEARNING INSTITUTE<br><b>OPEN TO EVERYONE / DEMO</b></div><div class="rc-campus-counts">${countLinks}</div></header><div class="rc-campus-layout"><aside class="rc-campus-sidebar"><span>DIRECTORY / 01—05</span><nav>${nav}</nav><div class="rc-campus-sidebottom">LEARN AT YOUR OWN PACE<br>MAKE ROOM FOR IDEAS</div></aside><div class="rc-content">${content}</div></div>${footer}</div>`
  if(config.shell==='field') return `<div class="rc rc-${escape(config.style)} rc-frame-field" data-nw="site"><div class="rc-field-top">${brand}<div>COASTAL FIELD STATION<br>OBSERVE · RECORD · SHARE</div>${countLinks}</div><div class="rc-field-layout"><aside class="rc-field-aside">${photo(deck,'02',14,'rc-field-aside-photo')}<div class="rc-field-aside-caption"><span>THE COAST<br>IS A LIVING<br>ARCHIVE.</span><small>FIELD NOTES / 001<br>EXPLORE THE STATION ↗</small></div></aside><div class="rc-field-main"><nav class="rc-field-nav">${nav}</nav><div class="rc-content">${content}</div></div></div>${footer}</div>`
  if(config.shell==='bazaar') return `<div class="rc rc-${escape(config.style)} rc-frame-bazaar" data-nw="site"><div class="rc-bazaar-strip">A MARKET FOR EVERYONE <span>GOOD FOOD · GOOD PEOPLE · GOOD DAYS</span></div><header class="rc-bazaar-header">${brand}<div class="rc-bazaar-address">NEIGHBOURHOOD MARKET<br><b>COME AS YOU ARE ↗</b></div><div class="rc-bazaar-counts">${countLinks}</div></header><div class="rc-content">${content}</div><nav class="rc-bazaar-dock"><span>FIND YOUR WAY /</span>${nav}${ctl('Home','go',0,'rc-navlink')}</nav>${footer}</div>`
  if(config.shell==='rail') return `<div class="rc rc-${escape(config.style)} rc-frame-rail" data-nw="site"><aside class="rc-rail">${brand}<div class="rc-rail-caption">THE INDEX / 01</div><div class="rc-rail-links">${nav}</div><div class="rc-rail-bottom">${countLinks}<span>INDEPENDENT<br>ENERGY STUDIO</span></div></aside><div class="rc-frame-main">${address}<div class="rc-content">${content}</div>${footer}</div></div>`
  if(config.shell==='console') return `<div class="rc rc-${escape(config.style)} rc-frame-console" data-nw="site"><header class="rc-console-header">${brand}<div class="rc-console-address">${escape(config.domain)}${escape(slide.path)}</div><span class="rc-console-status">● DEMO ONLINE</span></header><div class="rc-console-layout"><div class="rc-content">${content}</div><aside class="rc-console-side"><div class="rc-console-caption">NAVIGATION / 01</div><div class="rc-console-links">${nav}</div><div class="rc-console-caption">YOUR WORKSPACE</div>${countLinks}<div class="rc-console-foot">SYSTEM STATUS<br>LOCAL PROTOTYPE<br>NO LIVE DATA</div></aside></div>${footer}</div>`
  if(config.shell==='masthead') return `<div class="rc rc-${escape(config.style)} rc-frame-masthead" data-nw="site"><div class="rc-crumb-strip">A LITTLE SOMETHING GOOD, EVERY DAY <span>THE NEIGHBOURHOOD BAKERY · DEMO</span></div><header class="rc-masthead">${ctl('Browse','go',1,'rc-link')}${brand}<div class="rc-masthead-counts">${countLinks}</div></header><nav class="rc-masthead-nav">${nav}</nav><div class="rc-content">${content}</div>${footer}</div>`
  return `<div class="rc rc-${escape(config.style)}" data-nw="site">${address}<div class="rc-nav">${brand}<div class="rc-navlinks">${nav}</div><div class="rc-navright">${countLinks}</div></div><div class="rc-content">${content}</div>${footer}</div>`
}

export function handleSiteAction(deck,index,action,value,inputs={}) {
  if(!deck?.siteConfig) return null
  const st=stateFor(deck), item=Number(value), max=deck.slides.length-1
  if(action==='go'){st.filter='all';st.query='';st.notice='';return {navigate:Math.max(0,Math.min(max,item||0))}}
  if(action==='previous')return {navigate:Math.max(0,index-1)}
  if(action==='next')return {navigate:Math.min(max,index+1)}
  if(action==='filter') {st.filter=value;st.query=''}
  else if(action==='search') st.query=String(inputs.query||'').trim()
  else if(action==='qty') st.qty=Math.max(1,Math.min(99,st.qty+Number(value)))
  else if(action==='favorite') st.favorites=st.favorites.includes(item)?st.favorites.filter(i=>i!==item):[...st.favorites,item]
  else if(action==='saved') {st.filter='saved';st.query='';st.notice='';return {navigate:1}}
  else if(action==='add') {const row=st.basket.find(x=>x.i===item);if(row)row.qty=Math.min(99,row.qty+st.qty);else st.basket.push({i:item,qty:st.qty});st.notice='Added to your selection (demo).'}
  else if(action==='cart-plus'||action==='cart-minus') {const row=st.basket.find(x=>x.i===item);if(row)row.qty=Math.max(1,Math.min(99,row.qty+(action==='cart-plus'?1:-1)))}
  else if(action==='remove')st.basket=st.basket.filter(row=>row.i!==item)
  else if(action==='faq')st.openFaq=st.openFaq===item?-1:item
  else if(action==='calculate' && deck.siteConfig.tool) {
    const qtyText=String(inputs.toolQty ?? '').trim(), rateText=String(inputs.toolRate ?? '').trim()
    const qty=Number(qtyText), rate=Number(rateText)
    if (!qtyText || !rateText || !Number.isFinite(qty) || !Number.isInteger(qty) || !Number.isFinite(rate) || qty<0 || qty>1000000 || rate<0 || rate>1000000) {
      st.notice='Enter a whole number of units and a non-negative price, both within the allowed range.';st.toolResult=null
    } else {st.toolQty=qty;st.toolRate=rate;st.toolResult=Math.round(qty*rate*100)/100;st.notice=deck.siteConfig.tool.disclaimer}
  }
  else if(action==='book') {st.date=inputs.date||'';st.time=inputs.time||'10:00';st.guests=Number(inputs.guests)||2;st.notice=st.date?`Demo selection: ${st.date} · ${st.time} · ${st.guests} guest(s). No reservation has been made.`:'Choose a date to review your demo selection.'}
  else if(action==='confirm') {if(!st.basket.length){st.notice='Choose an item before confirming.'}else{st.basket=[];st.notice='';return {navigate:29}}}
  else return null
  return {refresh:true}
}

/** Extend the original three website cases as well; keep their visual families
 * and existing controls intact while adding interactive editorial screens. */
export function extendLegacySiteCases(decks) {
  const north = decks.find(d=>d.id==='northwind')
  const coffee = [
    ['A closer look at roasting','/journal/roasting', '01','The roastery','The work starts at the roastery, where small batches give each roast room to develop.'],
    ['At the source','/sourcing/landscape','07','The landscape','A closer look at the places and landscapes behind a cup of coffee.'],
    ['A fresh perspective','/journal/freshness','15','The details','Small choices in storage and brewing can change the cup.'],
    ['The daily ritual','/journal/daily-ritual','17','The ritual','From the first scoop to the last pour, a daily ritual can be simple.'],
    ['Coffee with company','/journal/together','18','The table','Coffee is also a reason to pause and spend time together.'],
  ]
  if(north){
    coffee.forEach(([title,path,img,head,body],i)=>north.slides.push({k:'nw-page',label:title,kind:'origins',path,nav:'Journal',kicker:'Northwind journal · field notes',title,note:'Explore two views',origins:[{name:'The story',img,region:'Field notes',head,body,rows:[['Explore','The story'],['Focus','Coffee and place']]},{name:'The roastery',img:i===4?'20':'01',region:'Behind the counter',head:'A look inside',body:'Explore the place and people behind the coffee.',rows:[['Explore','The roastery'],['Focus','Daily craft']]}]}))
    north.en='Northwind Coffee Co. · a 25-screen interactive shop'
    north.desc='A 25-screen coffee shop prototype with collection filters, product options, subscriptions, brewing calculations, cart and checkout interactions, plus five editorial field notes and 20 local photographs.'
    north.how='Twenty-five screens at 1440 × 900, with product options, live calculations, filters, editorial tabs and a prototype checkout. Existing and additional local photography is reused across the experience.'
  }
  const extras=[
    ['Street after dark','A closer look at the streets and the places that shape the neighbourhood.'],
    ['Light on the route','An everyday detail that changes the way the city feels after dark.'],
    ['People in the city','The people and work behind the streets we pass through.'],
    ['A different view','An alternate perspective on the places around us.'],
    ['City from above','A wider view of the neighbourhood and its changing rhythms.'],
  ]
  for(const id of ['bellwether','wavelength']){
    const deck=decks.find(d=>d.id===id);if(!deck)continue
    extras.forEach(([title,sub],i)=>{
      const image=String(11+i).padStart(2,'0'), next=String(11+(i+1)%5).padStart(2,'0')
      const page={k:id==='bellwether'?'bw-page':'wl-page',label:title,kind:'editorial',path:`/journal/field-notes-${i+1}`,nav:id==='bellwether'?'Journal':'Archive',crumb:'Field notes',bar:'Field notes',blocks:[{t:'hero',kicker:'Field notes · the city',title,sub,chips:{g:'view',items:[['This view','first',true],['Another view','second',false]]},panes:[{id:'first',img:image,name:title,meta:'Field notes · view 01',price:''},{id:'second',img:next,name:'Another perspective',meta:'Field notes · view 02',price:''}]}],band:['Field notes','Two views','The neighbourhood','Interactive prototype']}
      deck.slides.push(page)
    })
    const count=deck.slides.length
    deck.en=`${deck.name} · ${count} interactive screens`
    deck.desc=`An interactive ${count}-screen ${id==='bellwether'?'cycle workshop':'community radio'} prototype with 15 locally stored photographs. Explore the existing calculators and filters, plus five new city field notes with switchable images.`
    deck.how=`${count} screens at 1440 × 900. Each screen has a working control, including filters, calculators and image-view switches. The five new editorial screens reuse locally bundled city photographs.`
  }
}
