import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
// @ts-ignore browser JavaScript module
import {SOCIAL_CASES,renderSocialCase} from '../apps/web/public/social-cases.js'
// @ts-ignore browser JavaScript module
import {CASE_DECKS,slideHTML,deckPrompt} from '../apps/web/public/cases.js'

test('commercial carousel concepts cover ten categories with narrative pages and real image assets',()=>{
 assert.equal(SOCIAL_CASES.length,10)
 assert.equal(new Set(SOCIAL_CASES.map((d: any)=>d.category)).size,10)
 assert.equal(new Set(SOCIAL_CASES.map((d: any)=>d.social.style)).size,10)
 assert.equal(new Set(SOCIAL_CASES.map((d: any)=>d.paper)).size,10)
 for(const d of SOCIAL_CASES){
  assert.ok(CASE_DECKS.some((x: any)=>x.id===d.id))
  assert.equal(d.fmt,'card')
  assert.ok(d.slides.length>=3 && d.slides.length<=20)
  assert.equal(new Set(d.slides.map((s: any)=>s.kind)).size,d.slides.length)
  for(const slide of d.slides) if(slide.img) assert.ok(existsSync(`apps/web/public/cases/${d.id}/${slide.img}.jpg`),slide.img)
  for(const [i,s] of d.slides.entries()) {
   const html=slideHTML(d,s,i)
   assert.match(html,/social-card/)
   assert.ok(html.includes(`social-page-${s.kind}`))
   assert.match(html,new RegExp(`${String(i+1).padStart(2,'0')} — 08`))
   assert.doesNotMatch(html,/<button\b/i)
  }
  assert.match(renderSocialCase(d,d.slides.at(-1),7),/行动引导示例/)
  assert.ok(deckPrompt(d).includes(d.name))
 }
})

test('carousel controls are bound after initialization and support intentional horizontal touch swipes',()=>{
 const html=readFileSync('apps/web/public/index.html','utf8')
 const wiring=html.slice(html.indexOf('function wireCaseView() {'),html.indexOf('/* 目录来源：后端优先'))
 assert.match(wiring,/addEventListener\('touchstart'/)
 assert.match(wiring,/addEventListener\('touchend'/)
 assert.match(wiring,/caseState\.deck\?\.fmt !== 'card'/)
 assert.match(wiring,/Math\.abs\(dx\)>50/)
 assert.match(wiring,/gotoCasePage\(caseState\.i/)
 for (const category of ['品牌宣传','产品营销','知识科普','商业数据','旅游生活','餐饮美食','时尚穿搭','励志语录','房产商业','科技发布']) assert.ok(html.includes(`value="${category}"`))
})

test('long-form carousels have 35–50 distinct pages, working rendering and local image coverage', async()=>{
 // @ts-ignore browser JavaScript module
 const {SOCIAL_LONG_CASES,renderSocialLong}=await import('../apps/web/public/social-long-cases.js')
 assert.equal(SOCIAL_LONG_CASES.length,3)
 assert.equal(new Set(SOCIAL_LONG_CASES.map((d:any)=>d.paper)).size,3)
 assert.equal(new Set(SOCIAL_LONG_CASES.map((d:any)=>d.socialLong.style)).size,3)
 for(const d of SOCIAL_LONG_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.fmt,'card')
  assert.ok(d.slides.length>=35 && d.slides.length<=50)
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,d.slides.length)
  assert.equal(new Set(d.slides.map((s:any)=>s.lead)).size,d.slides.length)
  assert.equal(new Set(d.slides.map((s:any)=>s.chapter)).size,6)
  const images=new Set<string>()
  for(const [i,s] of d.slides.entries()){
   const html=slideHTML(d,s,i)
   assert.match(html,/long-social/)
   assert.ok(html.includes(`long-page-${s.kind}`))
   assert.ok(html.includes(`${String(i+1).padStart(2,'0')} — ${d.slides.length}`))
   assert.doesNotMatch(html,/<button\b/i)
   if(s.img){images.add(s.img);assert.ok(existsSync(`apps/web/public/cases/${d.id}/${s.img}.jpg`))}
  }
  assert.equal(images.size,15)
  assert.match(renderSocialLong(d,d.slides.at(-1),d.slides.length-1),/行动引导示例/)
  assert.ok(deckPrompt(d).includes(d.slides.at(-1).title))
 }
})

test('English long-form carousel cases contain 36 distinct English screens and local imagery', async()=>{
 // @ts-ignore browser JavaScript module
 const {ENGLISH_SOCIAL_LONG_CASES}=await import('../apps/web/public/social-long-english.js')
 assert.equal(ENGLISH_SOCIAL_LONG_CASES.length,3)
 assert.equal(new Set(ENGLISH_SOCIAL_LONG_CASES.map((d:any)=>d.socialLong.style)).size,3)
 for(const d of ENGLISH_SOCIAL_LONG_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.slides.length,36)
  assert.equal(d.socialLong.language,'en')
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.lead)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.chapter)).size,6)
  const imgs=new Set<string>()
  for(const [i,s] of d.slides.entries()){
   const html=slideHTML(d,s,i)
   assert.match(html,/long-en/)
   assert.ok(html.includes(`${String(i+1).padStart(2,'0')} — 36`))
   assert.doesNotMatch(html,/[\u3400-\u9fff]/)
   assert.doesNotMatch(html,/<button\b/i)
   if(s.img){imgs.add(s.img);assert.ok(existsSync(`apps/web/public/cases/${d.id}/${s.img}.jpg`))}
  }
  assert.equal(imgs.size,15)
  assert.match(slideHTML(d,d.slides[35],35),/DEMO CTA/)
 }
})

test('every carousel actually renders at least 15 distinct local image files', async()=>{
 const {createHash}=await import('node:crypto')
 for(const d of CASE_DECKS.filter((deck:any)=>deck.fmt==='card')) {
  const ids=new Set<string>()
  for(const [i,s] of d.slides.entries()) for(const match of slideHTML(d,s,i).matchAll(new RegExp(`src="cases/${d.id}/(\\d\\d)\\.jpg"`,'g'))) ids.add(match[1])
  assert.ok(ids.size>=15,`${d.id} renders only ${ids.size} images`)
  const hashes=new Set([...ids].map(id=>createHash('sha256').update(readFileSync(`apps/web/public/cases/${d.id}/${id}.jpg`)).digest('hex')))
  assert.ok(hashes.size>=15,`${d.id} only has ${hashes.size} unique image files`)
 }
})

test('three new English long-form stories have 36 distinct, fully English pages', async()=>{
 // @ts-ignore browser JavaScript module
 const {MORE_ENGLISH_SOCIAL_CASES}=await import('../apps/web/public/social-long-english-more.js')
 assert.equal(MORE_ENGLISH_SOCIAL_CASES.length,3)
 for(const d of MORE_ENGLISH_SOCIAL_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.slides.length,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.lead)).size,36)
  for(const [i,s] of d.slides.entries()) {
   const html=slideHTML(d,s,i)
   assert.doesNotMatch(html,/[\u3400-\u9fff]/)
   assert.ok(html.includes(`${String(i+1).padStart(2,'0')} — 36`))
  }
 }
})
