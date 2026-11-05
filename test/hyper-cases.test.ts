import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
// @ts-ignore browser modules
import { HYPER_CASES,renderHyperCase } from '../apps/web/public/hyper-cases.js'
// @ts-ignore browser modules
import { CASE_DECKS,slideHTML } from '../apps/web/public/cases.js'

test('50 Hyper Frames concepts use real local motion footage across six frames',()=>{
 assert.equal(HYPER_CASES.length,50)
 assert.equal(new Set(HYPER_CASES.map((d:any)=>d.id)).size,50)
 assert.equal(new Set(HYPER_CASES.map((d:any)=>d.name)).size,50)
 assert.equal(new Set(HYPER_CASES.map((d:any)=>d.hyperStory.group)).size,10)
 assert.equal(new Set(HYPER_CASES.map((d:any)=>d.hyperStory.variant)).size,5)
 assert.equal(new Set(HYPER_CASES.map((d:any)=>d.paper)).size,50)
 for(const d of HYPER_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.fmt,'hyper');assert.equal(d.slides.length,6)
  assert.match(d.desc,/shared video footage/);assert.match(d.desc,/not synchronized/)
  const videos=new Set<string>()
  for(const [i,s] of d.slides.entries()){
   const path=`apps/web/public/cases/${d.id}/${s.img}.mp4`,poster=`apps/web/public/cases/${d.id}/${s.img}.jpg`
   assert.ok(existsSync(path));assert.ok(existsSync(poster))
   const bytes=readFileSync(path);assert.ok(bytes.length>10000);assert.equal(bytes.subarray(4,8).toString(),'ftyp')
   videos.add(createHash('sha256').update(bytes).digest('hex'))
   const html=slideHTML(d,s,i)
   assert.match(html,/<video\b[^>]*controls[^>]*playsinline/)
   assert.ok(html.includes(`src="cases/${d.id}/${s.img}.mp4"`))
   assert.ok(html.includes(`poster="cases/${d.id}/${s.img}.jpg"`))
   assert.match(html,/hf-motion/);assert.match(html,/REUSED FOOTAGE/)
   assert.ok(html.includes(`https://www.pexels.com/video/${s.sourceId}/`))
   const thumbnail=renderHyperCase(d,s,i,true)
   assert.match(thumbnail,/hf-thumbnail/);assert.doesNotMatch(thumbnail,/<video\b|<a\s/i)
  }
  assert.ok(videos.size>=3,`${d.name}: footage must contain at least three real clips`)
 }
})

test('motion overlays respect reduced motion and thumbnail previews do not play or animate',()=>{
 const css=readFileSync('apps/web/public/hyper-cases.css','utf8')
 assert.match(css,/@keyframes hf-spin/);assert.match(css,/@keyframes hf-slide/);assert.match(css,/@keyframes hf-sweep/)
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/hf-thumbnail \.hf-motion i\{animation:none\}/)
 assert.match(css,/pointer-events:none/)
 const index=readFileSync('apps/web/public/index.html','utf8')
 assert.match(index,/hyper-cases\.css/);assert.match(index,/\.hyper-story video/)
})
