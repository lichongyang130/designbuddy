import { VIDEO_CASES } from './video-cases.js'

// Fifty fictional motion-design concepts, using the same documented, shared
// footage library as the video stories. CSS overlays are live browser effects;
// the individual video scenes are not a rendered or synchronized export.
const concepts=[
 ['The Shape of Light','Open Air Identity','Seen in Motion','A Wider Beginning','Presence / A Brand Study'],
 ['The Art of Heat','Savour in Motion','Table / A Title Sequence','The Daily Ingredient','A Taste of Rhythm'],
 ['City Signal','The Space Between Stops','Moving Through','On the Way Somewhere','Lines of Arrival'],
 ['A Slower Frequency','The Everyday Loop','Breathing Room','A Moment to Notice','The Shape of a Day'],
 ['Lines Become Places','The City in Layers','Built / Unbuilt','A Study of Edges','The Space We Share'],
 ['The Current and the Coast','Water Finds a Way','The Rhythm of Outside','In the Open','Elemental / A Moving Study'],
 ['Curiosity Engine','The Making Signal','Small Experiments','Future in Process','Built from Questions'],
 ['People in Passing','The Moment of Trying','A Different Rhythm','Human Scale','Here and Moving'],
 ['An Idea in Motion','The Practice of Looking','A Question in Frames','Learning in Layers','The Open Workshop'],
 ['A Minute of Elsewhere','Keep Looking','Move Through Today','Four Ways to See','A Brief Change of Scene']
]
const acts=[['OPEN','Set the scene'],['SIGNAL','Introduce the idea'],['MOMENT','Look a little closer'],['TYPE','Give the moment a voice'],['RHYTHM','Find the visual rhythm'],['CLOSE','Leave a final impression']]
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const HYPER_CASES=VIDEO_CASES.map((source,n)=>{
 const group=Math.floor(n/5),variant=n%5,name=concepts[group][variant],hue=(n*137+25)%360
 const color=`hsl(${hue} 75% 70%)`,paper=`hsl(${hue} 27% ${group%2?13:10}%)`
 return {...source,id:`hyper-motion-${String(n+1).padStart(2,'0')}`,name,en:name,cat:'Hyper Frames',fmt:'hyper',ratio:'1280×860 · motion frame preview',kind:`${source.videoStory.genre} · motion identity`,
  tags:['hyper','motion design','real footage','English',source.videoStory.genre],
  desc:`${name} is a fictional six-frame motion concept with real, shared video footage and live CSS graphics. Scenes play separately; overlay animation is not synchronized with playback or exported.`,
  bestFor:['Motion identity','Title sequences','Social storytelling','Motion design previews'],
  visual:`${source.videoStory.genre} · frame design ${variant+1} · ${color}`,
  how:'Select a frame to play its local video using native controls. CSS graphics move independently of the video. Scenes are separate previews, not an exported or synchronized film. Footage is reused; Pexels source and license links are shown per frame. Vertical/square source concepts are cropped only in their video previews.',
  styles:[paper,color,'#f6f3ed'],colorway:`${paper} · ${color} · off-white`,paper,ink:'#f6f3ed',accent:color,second:'#273335',muted:'#c3ccca',rule:'#465553',body:'#f4f1eb',display:'sans',
  hyperStory:{group,variant,genre:source.videoStory.genre},
  slides:acts.map(([stage,caption],i)=>{const src=source.slides[i%source.slides.length];return {k:'hyper-story',label:`${String(i+1).padStart(2,'0')} · ${stage}`,title:src.title,img:String(i+1).padStart(2,'0'),clip:src.clip,sourceId:src.sourceId,stage,caption,line:source.slides[0].line}})
 }
})
export function renderHyperCase(deck,slide,index=0,thumbnail=false){
 const cfg=deck.hyperStory,n=String(index+1).padStart(2,'0'),base=`cases/${escape(deck.id)}/${escape(slide.img)}`
 const media=thumbnail?`<img src="${base}.jpg" alt="" loading="lazy">`:`<video src="${base}.mp4" poster="${base}.jpg" controls playsinline preload="none" aria-label="Play ${escape(slide.title)}"><p>Video playback is not supported in this browser.</p></video><p class="vs-error hf-error" hidden>Video could not be loaded. Check your connection or try another browser.</p>`
 const type=`<div class="hf-type"><span class="hf-eyebrow">${escape(cfg.genre)} / ${escape(slide.stage)}</span><h1>${escape(deck.name)}</h1><p>${escape(slide.line)}</p><div class="hf-caption"><b>${n}</b><span>${escape(slide.caption)}<br><small>${escape(slide.title)}</small></span></div></div>`
 const video=`<div class="hf-video-wrap"><div class="hf-player">${media}<div class="hf-video-tint"></div><div class="hf-motion hf-motion-${index%3}" aria-hidden="true"><i></i><i></i><i></i></div></div><div class="hf-shot"><span>SHOT ${n} / 06</span><span>LOCAL FOOTAGE · SHARED</span></div></div>`
 let body
 if(cfg.variant===0)body=`<div class="hf-body hf-body-overlay">${video}${type}<div class="hf-edge-word" aria-hidden="true">MOTION / ${escape(slide.stage)}</div></div>`
 else if(cfg.variant===1)body=`<div class="hf-body hf-body-split">${video}${type}</div>`
 else if(cfg.variant===2)body=`<div class="hf-body hf-body-poster"><div class="hf-poster-heading"><span>MOTION STUDY<br>IN SIX FRAMES</span><strong>${escape(slide.stage)}</strong></div>${video}${type}</div>`
 else if(cfg.variant===3)body=`<div class="hf-body hf-body-editorial"><div class="hf-editorial-head"><span>${escape(cfg.genre)}</span><span>FRAME / ${n}</span></div>${type}${video}</div>`
 else body=`<div class="hf-body hf-body-grid"><div class="hf-grid-side"><span>DESIGN<br>IN<br>MOTION</span><i></i><small>PROJECT ${String(cfg.group*5+cfg.variant+1).padStart(2,'0')}</small></div>${video}${type}</div>`
 const attribution=thumbnail?`PEXELS #${escape(slide.sourceId)}`:`<a href="https://www.pexels.com/video/${escape(slide.sourceId)}/" target="_blank" rel="noopener noreferrer">PEXELS #${escape(slide.sourceId)}</a> / <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer">LICENSE</a>`
 return `<div class="hyper-story hf-family-${cfg.group} hf-layout-${cfg.variant}${thumbnail?' hf-thumbnail':''}"><header><span><b>HYPER</b> / FRAMES</span><span>${escape(cfg.genre)} · MOTION STUDY</span><span>FRAME ${n} / 06</span></header>${body}<footer><span>FICTIONAL CONCEPT · OVERLAY MOVES INDEPENDENTLY</span><span>${attribution} · REUSED FOOTAGE</span><span>${n} / 06</span></footer></div>`
}
