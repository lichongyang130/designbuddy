import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {existsSync,readFileSync} from 'node:fs'
// @ts-ignore browser JavaScript module
import { ARTIFACT_CASES,renderArtifactCase,handleArtifactAction } from '../apps/web/public/artifact-cases.js'
// @ts-ignore browser JavaScript module
import { CASE_DECKS,slideHTML } from '../apps/web/public/cases.js'

test('50 interactive English artifacts expose 36 navigable screens and 15 distinct displayed photos',()=>{
 assert.equal(ARTIFACT_CASES.length,50)
 assert.equal(new Set(ARTIFACT_CASES.map((d:any)=>d.id)).size,50)
 assert.equal(new Set(ARTIFACT_CASES.map((d:any)=>d.name)).size,50)
 assert.equal(new Set(ARTIFACT_CASES.map((d:any)=>d.artifactLive.kind)).size,10)
 for(const d of ARTIFACT_CASES){
  assert.ok(CASE_DECKS.some((x:any)=>x.id===d.id))
  assert.equal(d.fmt,'artifact')
  assert.equal(d.slides.length,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.kind)).size,6)
  const images=new Set<string>()
  for(const [i,s] of d.slides.entries()){
   const html=slideHTML(d,s,i)
   assert.match(html,/art-live/)
   assert.match(html,/data-art-action="go"/)
   assert.match(html,/data-art-action="pin"/)
   assert.match(html,/data-art-action="reset"/)
   assert.doesNotMatch(html,/[\u3400-\u9fff]|<button\b/i)
   assert.ok(html.includes(`src="cases/${d.id}/${s.img}.jpg"`))
   assert.ok(existsSync(`apps/web/public/cases/${d.id}/${s.img}.jpg`))
   images.add(s.img)
  }
  assert.equal(images.size,15)
  assert.equal(new Set([...images].map(id=>createHash('sha256').update(readFileSync(`apps/web/public/cases/${d.id}/${id}.jpg`)).digest('hex'))).size,15)
 }
})

test('artifact options, estimates, pinning, navigation and reset are isolated and local',()=>{
 for(const d of ARTIFACT_CASES){
  const c=d.artifactLive
  assert.deepEqual(handleArtifactAction(d,0,'go','35'),{navigate:35})
  assert.deepEqual(handleArtifactAction(d,35,'go','999'),{navigate:35})
  assert.deepEqual(handleArtifactAction(d,1,'choice','1'),{refresh:true})
  assert.deepEqual(handleArtifactAction(d,3,'quantity','1'),{refresh:true})
  const html=renderArtifactCase(d,d.slides[3],3)
  assert.ok(html.includes(`$${((c.base+c.choices[1][1])*2).toLocaleString('en-US')}`))
  assert.match(html,/Illustrative estimate updated/)
  handleArtifactAction(d,3,'pin','3')
  assert.match(renderArtifactCase(d,d.slides[3],3),/♥ Pinned/)
  assert.match(renderArtifactCase(d,d.slides[4],4),/YOUR PINNED VIEWS/)
  handleArtifactAction(d,5,'confirm','')
  assert.match(renderArtifactCase(d,d.slides[5],5),/No transaction, booking or message was sent/)
  assert.equal(handleArtifactAction(d,0,'choice','999'),null)
  handleArtifactAction(d,0,'reset','')
  assert.match(renderArtifactCase(d,d.slides[0],0),/Demo reset/)
 }
})

test('artifact events are attached after initialization and scoped to the preview stage',()=>{
 const html=readFileSync('apps/web/public/index.html','utf8')
 const wiring=html.slice(html.indexOf('function wireCaseView() {'),html.indexOf('/* 目录来源：后端优先'))
 assert.match(wiring,/addEventListener\('click', handleArtifactControl\)/)
 assert.match(wiring,/addEventListener\('keydown', handleArtifactControl\)/)
 assert.match(html,/control\.closest\('#tvStage'\)/)
})

test('redesigned artifacts have 50 distinct brands, palettes and option sets with five different shell hierarchies',()=>{
 assert.equal(new Set(ARTIFACT_CASES.map((d:any)=>d.paper)).size,50)
 assert.equal(new Set(ARTIFACT_CASES.map((d:any)=>d.en)).size,50)
 assert.equal(new Set(ARTIFACT_CASES.map((d:any)=>d.artifactLive.choices.map((x:any)=>x[0]).join('|'))).size,50)
 assert.equal(new Set(ARTIFACT_CASES.map((d:any)=>d.artifactLive.shell)).size,5)
 const markers=['art-shell-workspace','art-shell-index','art-shell-ledger','art-shell-editorial','art-shell-visual']
 for(const d of ARTIFACT_CASES){
  const html=renderArtifactCase(d,d.slides[0],0)
  assert.ok(html.includes(markers[d.artifactLive.variant]),d.name)
  assert.ok(html.includes(d.artifactLive.brand.replaceAll('&','&amp;')),d.name)
  assert.ok(html.includes(d.artifactLive.purpose.replaceAll('&','&amp;')),d.name)
  assert.equal(d.slides.length,36)
  assert.equal(new Set(d.slides.map((s:any)=>s.title)).size,36,d.name)
 }
})

test('different artifact products retain independent configuration and use product-specific options',()=>{
 const [a,b]=ARTIFACT_CASES
 handleArtifactAction(a,0,'reset','')
 handleArtifactAction(b,0,'reset','')
 handleArtifactAction(a,1,'choice','2')
 handleArtifactAction(a,1,'quantity','1')
 const htmlA=renderArtifactCase(a,a.slides[3],3)
 const htmlB=renderArtifactCase(b,b.slides[3],3)
 assert.ok(htmlA.includes(a.artifactLive.choices[2][0]))
 assert.ok(htmlA.includes(`$${((a.artifactLive.base+a.artifactLive.choices[2][1])*2).toLocaleString('en-US')}`))
 assert.ok(htmlB.includes(`$${(b.artifactLive.base+b.artifactLive.choices[0][1]).toLocaleString('en-US')}`))
 assert.ok(!htmlB.includes(a.artifactLive.choices[2][0]))
 handleArtifactAction(a,0,'reset','')
 handleArtifactAction(b,0,'reset','')
})
