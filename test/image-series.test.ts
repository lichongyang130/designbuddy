import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {existsSync,readFileSync} from 'node:fs'
// @ts-ignore browser JavaScript module
import { IMAGE_SERIES_CASES } from '../apps/web/public/image-series-cases.js'
// @ts-ignore browser JavaScript module
import { CASE_DECKS, slideHTML, deckPrompt } from '../apps/web/public/cases.js'

test('new image campaigns contain 36 English screens and 15 distinct displayed local images',()=>{
 assert.equal(IMAGE_SERIES_CASES.length,3)
 assert.equal(new Set(IMAGE_SERIES_CASES.map((d:any)=>d.paper)).size,3)
 assert.equal(new Set(IMAGE_SERIES_CASES.map((d:any)=>d.imageSeries.style)).size,3)
 for(const d of IMAGE_SERIES_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.fmt,'image')
  assert.ok(d.slides.length>=35 && d.slides.length<=50)
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.lead)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.chapter)).size,6)
  assert.equal(new Set(d.slides.map((s:any)=>s.layout)).size,6)
  const images=new Set<string>()
  for(const [i,s] of d.slides.entries()){
   const html=slideHTML(d,s,i)
   assert.match(html,new RegExp(`image-series-layout-${s.layout}`))
   assert.match(html,new RegExp(`IMAGE ${String(i+1).padStart(2,'0')} / 36`))
   assert.doesNotMatch(html,/[\u3400-\u9fff]/)
   assert.doesNotMatch(html,/<button\b/i)
   const path=`cases/${d.id}/${s.img}.jpg`
   assert.ok(html.includes(`src="${path}"`))
   assert.ok(existsSync(`apps/web/public/${path}`))
   images.add(s.img)
  }
  assert.equal(images.size,15)
  assert.equal(new Set([...images].map(id=>createHash('sha256').update(readFileSync(`apps/web/public/cases/${d.id}/${id}.jpg`)).digest('hex'))).size,15)
  assert.ok(deckPrompt(d).includes(d.slides.at(-1).title))
 }
})

test('image preview supports horizontal touch navigation',()=>{
 const html=readFileSync('apps/web/public/index.html','utf8')
 const wiring=html.slice(html.indexOf('function wireCaseView() {'),html.indexOf('/* 目录来源：后端优先'))
 assert.match(wiring,/caseState\.deck\?\.fmt !== 'image'/)
 assert.match(wiring,/Math\.abs\(dx\)>50/)
 assert.match(wiring,/gotoCasePage\(caseState\.i/)
})

test('additional image campaigns meet the long-form page and rendered-photo requirements',async()=>{
 // @ts-ignore browser JavaScript module
 const {MORE_IMAGE_SERIES_CASES}=await import('../apps/web/public/image-series-more.js')
 assert.equal(MORE_IMAGE_SERIES_CASES.length,3)
 assert.equal(new Set(MORE_IMAGE_SERIES_CASES.map((d:any)=>d.imageSeries.style)).size,3)
 for(const d of MORE_IMAGE_SERIES_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.fmt,'image')
  assert.equal(d.slides.length,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.lead)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.chapter)).size,6)
  const images=new Set<string>()
  for(const [i,s] of d.slides.entries()){
   const html=slideHTML(d,s,i)
   assert.match(html,new RegExp(`image-series-layout-${s.layout}`))
   assert.ok(html.includes(`IMAGE ${String(i+1).padStart(2,'0')} / 36`))
   assert.doesNotMatch(html,/[\u3400-\u9fff]|<button\b/i)
   assert.ok(html.includes(`src="cases/${d.id}/${s.img}.jpg"`))
   assert.ok(existsSync(`apps/web/public/cases/${d.id}/${s.img}.jpg`))
   images.add(s.img)
  }
  assert.equal(images.size,15)
  const hashes=new Set([...images].map(id=>createHash('sha256').update(readFileSync(`apps/web/public/cases/${d.id}/${id}.jpg`)).digest('hex')))
  assert.equal(hashes.size,15)
 }
})

test('third set of image campaigns includes 36 unique English screens and 15 actual images each',async()=>{
 // @ts-ignore browser JavaScript module
 const {THIRD_IMAGE_SERIES_CASES}=await import('../apps/web/public/image-series-third.js')
 assert.equal(THIRD_IMAGE_SERIES_CASES.length,3)
 assert.equal(new Set(THIRD_IMAGE_SERIES_CASES.map((d:any)=>d.imageSeries.style)).size,3)
 for(const d of THIRD_IMAGE_SERIES_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.fmt,'image')
  assert.equal(d.slides.length,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.lead)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.chapter)).size,6)
  const images=new Set<string>()
  for(const [i,s] of d.slides.entries()){
   const html=slideHTML(d,s,i)
   assert.match(html,new RegExp(`image-series-layout-${s.layout}`))
   assert.ok(html.includes(`IMAGE ${String(i+1).padStart(2,'0')} / 36`))
   assert.doesNotMatch(html,/[\u3400-\u9fff]|<button\b/i)
   assert.ok(html.includes(`src="cases/${d.id}/${s.img}.jpg"`))
   assert.ok(existsSync(`apps/web/public/cases/${d.id}/${s.img}.jpg`))
   images.add(s.img)
  }
  assert.equal(images.size,15)
  assert.equal(new Set([...images].map(id=>createHash('sha256').update(readFileSync(`apps/web/public/cases/${d.id}/${id}.jpg`)).digest('hex'))).size,15)
 }
})

test('ten new image campaigns each render 36 unique English pages and 15 distinct photographs',async()=>{
 // @ts-ignore browser JavaScript module
 const {BATCH_IMAGE_SERIES_CASES}=await import('../apps/web/public/image-series-batch.js')
 assert.equal(BATCH_IMAGE_SERIES_CASES.length,10)
 assert.equal(new Set(BATCH_IMAGE_SERIES_CASES.map((d:any)=>d.id)).size,10)
 assert.equal(new Set(BATCH_IMAGE_SERIES_CASES.map((d:any)=>d.imageSeries.style)).size,10)
 assert.equal(new Set(BATCH_IMAGE_SERIES_CASES.map((d:any)=>d.paper)).size,10)
 for(const d of BATCH_IMAGE_SERIES_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.fmt,'image')
  assert.equal(d.slides.length,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,36, d.id)
  assert.equal(new Set(d.slides.map((s:any)=>s.lead)).size,36, d.id)
  assert.equal(new Set(d.slides.map((s:any)=>s.chapter)).size,6)
  assert.equal(new Set(d.slides.map((s:any)=>s.layout)).size,6)
  const images=new Set<string>()
  for(const [i,s] of d.slides.entries()){
   const html=slideHTML(d,s,i)
   assert.ok(html.includes(`image-series-layout-${s.layout}`))
   assert.ok(html.includes(`IMAGE ${String(i+1).padStart(2,'0')} / 36`))
   assert.doesNotMatch(html,/[\u3400-\u9fff]|<button\b/i)
   assert.ok(html.includes(`src="cases/${d.id}/${s.img}.jpg"`))
   assert.ok(existsSync(`apps/web/public/cases/${d.id}/${s.img}.jpg`))
   images.add(s.img)
  }
  assert.equal(images.size,15)
  assert.equal(new Set([...images].map(id=>createHash('sha256').update(readFileSync(`apps/web/public/cases/${d.id}/${id}.jpg`)).digest('hex'))).size,15)
 }
})

test('fifty image campaigns each contain 36 English screens and 15 distinct local photos',async()=>{
 // @ts-ignore browser JavaScript module
 const {FIFTY_IMAGE_SERIES_CASES}=await import('../apps/web/public/image-series-fifty.js')
 assert.equal(FIFTY_IMAGE_SERIES_CASES.length,50)
 assert.equal(new Set(FIFTY_IMAGE_SERIES_CASES.map((d:any)=>d.id)).size,50)
 assert.equal(new Set(FIFTY_IMAGE_SERIES_CASES.map((d:any)=>d.name)).size,50)
 assert.equal(new Set(FIFTY_IMAGE_SERIES_CASES.map((d:any)=>d.paper)).size,50)
 assert.equal(new Set(FIFTY_IMAGE_SERIES_CASES.map((d:any)=>d.imageSeries.style)).size,10)
 for(const d of FIFTY_IMAGE_SERIES_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.fmt,'image')
  assert.equal(d.slides.length,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,36,d.id)
  assert.equal(new Set(d.slides.map((s:any)=>s.lead)).size,36,d.id)
  assert.equal(new Set(d.slides.map((s:any)=>s.chapter)).size,6,d.id)
  assert.equal(new Set(d.slides.map((s:any)=>s.layout)).size,6,d.id)
  const images=new Set<string>()
  for(const [i,s] of d.slides.entries()){
   const html=slideHTML(d,s,i)
   assert.match(html,new RegExp(`image-series-layout-${s.layout}`))
   assert.ok(html.includes(`IMAGE ${String(i+1).padStart(2,'0')} / 36`))
   assert.doesNotMatch(html,/[\u3400-\u9fff]|<button\b/i)
   assert.ok(html.includes(`src="cases/${d.id}/${s.img}.jpg"`))
   assert.ok(existsSync(`apps/web/public/cases/${d.id}/${s.img}.jpg`))
   images.add(s.img)
  }
  assert.equal(images.size,15,d.id)
  assert.equal(new Set([...images].map(id=>createHash('sha256').update(readFileSync(`apps/web/public/cases/${d.id}/${id}.jpg`)).digest('hex'))).size,15,d.id)
 }
})
