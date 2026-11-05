import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
// @ts-ignore browser modules
import {VIDEO_CASES,renderVideoStory} from '../apps/web/public/video-cases.js'
// @ts-ignore browser modules
import {CASE_DECKS,slideHTML} from '../apps/web/public/cases.js'

test('50 new video concepts use real local MP4 footage in four preview scenes',()=>{
 assert.equal(VIDEO_CASES.length,50)
 assert.equal(new Set(VIDEO_CASES.map((d:any)=>d.id)).size,50)
 assert.equal(new Set(VIDEO_CASES.map((d:any)=>d.name)).size,50)
 assert.equal(new Set(VIDEO_CASES.map((d:any)=>d.videoStory.group)).size,10)
 assert.equal(new Set(VIDEO_CASES.map((d:any)=>d.videoStory.ratio)).size,3)
 const allClips=new Set<string>()
 for(const d of VIDEO_CASES){
  assert.ok(CASE_DECKS.some((c:any)=>c.id===d.id))
  assert.equal(d.fmt,'video');assert.equal(d.slides.length,4)
  assert.match(d.desc,/shared real video footage/)
  assert.match(d.how,/not one continuous exported film/)
  for(const [i,s] of d.slides.entries()){
   const video=`apps/web/public/cases/${d.id}/${s.img}.mp4`
   const poster=`apps/web/public/cases/${d.id}/${s.img}.jpg`
   assert.ok(existsSync(video));assert.ok(existsSync(poster))
   const bytes=readFileSync(video)
   assert.ok(bytes.length>10_000)
   assert.equal(bytes.subarray(4,8).toString(),'ftyp')
   allClips.add(createHash('sha256').update(bytes).digest('hex'))
   const html=slideHTML(d,s,i)
   assert.match(html,/<video\b[^>]*controls[^>]*playsinline/)
   assert.ok(html.includes(`src="cases/${d.id}/${s.img}.mp4"`))
   assert.ok(html.includes(`poster="cases/${d.id}/${s.img}.jpg"`))
   assert.ok(html.includes(`https://www.pexels.com/video/${s.sourceId}/`))
   assert.match(html,/REUSED/)
   assert.match(html,/vs-error/)
   const thumb=slideHTML(d,s,i,true)
   assert.doesNotMatch(thumb,/<video\b|<a\s/i)
   assert.ok(thumb.includes(`src="cases/${d.id}/${s.img}.jpg"`))
  }
 }
 assert.ok(allClips.size>=15,`expected genuine diversity, got ${allClips.size}`)
})

test('each video thumbnail has only a poster, with an actual player on the preview stage',()=>{
 const d=VIDEO_CASES[0],s=d.slides[0]
 assert.match(renderVideoStory(d,s,0,false),/<video\b/)
 assert.doesNotMatch(renderVideoStory(d,s,0,true),/<video\b/)
 const html=readFileSync('apps/web/public/index.html','utf8')
 assert.match(html,/slideHTML\(deck, sl, i, !!\(deck\.videoStory \|\| deck\.hyperStory\)\)/)
 assert.match(html,/video\.addEventListener\('error'/)
 assert.match(html,/video-cases\.css/)
 const source=readFileSync('apps/web/public/video-footage/ATTRIBUTION.md','utf8')
 assert.match(source,/Pexels License/)
 assert.match(source,/not.*CC0/i)
})
