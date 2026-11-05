import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
// @ts-ignore -- browser case module is plain JavaScript
import { SITE_CASES, renderSiteCase, handleSiteAction } from '../apps/web/public/website-cases.js'
// @ts-ignore -- browser case module is plain JavaScript
import { CASE_DECKS, slideHTML } from '../apps/web/public/cases.js'

test('new website cases expose 30 interactive screens and 15 actually rendered local photos each', () => {
  assert.ok(SITE_CASES.length >= 6)
  for (const deck of SITE_CASES) {
    assert.ok(CASE_DECKS.some((item: {id:string}) => item.id === deck.id))
    assert.equal(deck.slides.length, 30)
    assert.equal(new Set(deck.slides.map((s: {path:string})=>s.path)).size, 30)
    const images = new Set<string>()
    for (const [index, slide] of deck.slides.entries()) {
      const html = slideHTML(deck, slide, index)
      assert.match(html, /data-rc="go"/)
      assert.match(html, /data-rc="next"/)
      assert.doesNotMatch(html, /<button\b/i)
      for (const match of html.matchAll(new RegExp(`src="cases/${deck.id}/(\\d{2})\\.jpg"`, 'g'))) images.add(match[1])
    }
    assert.equal(images.size, 15, deck.id)
    for (const image of images) assert.ok(existsSync(join('apps/web/public/cases',deck.id,`${image}.jpg`)))
  }
})

test('site interactions navigate, filter, save, adjust the cart and book without transactions', () => {
  const deck = SITE_CASES[0]
  assert.deepEqual(handleSiteAction(deck,0,'go','5'),{navigate:5})
  handleSiteAction(deck,1,'filter','first')
  assert.match(renderSiteCase(deck,deck.slides[1],1),/3 results/)
  handleSiteAction(deck,1,'search','',{query:'Moon'})
  assert.match(renderSiteCase(deck,deck.slides[1],1),/1 results/)
  handleSiteAction(deck,5,'favorite','0')
  assert.match(renderSiteCase(deck,deck.slides[5],5),/♥ Saved/)
  handleSiteAction(deck,5,'qty','1')
  handleSiteAction(deck,5,'add','0')
  assert.match(renderSiteCase(deck,deck.slides[27],27),/\$76/)
  handleSiteAction(deck,27,'cart-minus','0')
  assert.match(renderSiteCase(deck,deck.slides[27],27),/\$38/)
  handleSiteAction(deck,22,'book','',{date:'2027-02-12',time:'14:00',guests:'3'})
  assert.match(renderSiteCase(deck,deck.slides[22],22),/2027-02-12 · 14:00 · 3 guest/)
  assert.deepEqual(handleSiteAction(deck,28,'confirm',''),{navigate:29})
  assert.match(renderSiteCase(deck,deck.slides[27],27),/selection is empty/)
  handleSiteAction(deck,11,'faq','1')
  assert.match(renderSiteCase(deck,deck.slides[11],11),/adjust quantities or remove an item/)
})

test('all website cases meet the requested screen and actually rendered image budgets', () => {
  for (const deck of CASE_DECKS.filter((d: {fmt:string})=>d.fmt==='site')) {
    const images = new Set<string>()
    for (const [index, slide] of deck.slides.entries()) {
      const html = slideHTML(deck, slide, index)
      for (const match of html.matchAll(new RegExp(`src="cases/${deck.id}/(\\d{2})\\.jpg"`, 'g'))) images.add(match[1])
    }
    assert.ok(deck.slides.length>=25 && deck.slides.length<=50,deck.id)
    assert.ok(images.size>=15 && images.size<=20,`${deck.id}: ${images.size} rendered photos`)
  }
})

test('legacy editorial additions have two independent image views', () => {
  for(const id of ['northwind','bellwether','wavelength']) {
    const deck = CASE_DECKS.find((d: {id:string})=>d.id===id)
    for(const slide of deck.slides.slice(-5)) {
      const html=slideHTML(deck,slide,0)
      assert.match(html, id==='northwind' ? /data-nw="tab"/ : /data-bw="chip"/)
      assert.ok([...html.matchAll(/src="cases\/[^/]+\/\d\d\.jpg"/g)].length >= 2)
    }
  }
})


test('additional cases calculate sample costs with validation and isolated state', () => {
  for (const id of ['forest-site','heritage-site','letterpress-site']) {
    const deck = SITE_CASES.find((d: {id:string})=>d.id===id)
    assert.ok(deck)
    assert.equal(deck.slides[24].kind,'calculator')
    assert.deepEqual(handleSiteAction(deck,24,'calculate','',{toolQty:'20',toolRate:'2.5'}),{refresh:true})
    let html=renderSiteCase(deck,deck.slides[24],24)
    assert.match(html,/\$50\.00/)
    assert.match(html,/Illustrative/)
    handleSiteAction(deck,24,'calculate','',{toolQty:'-1',toolRate:'5'})
    html=renderSiteCase(deck,deck.slides[24],24)
    assert.match(html,/non-negative/)
    assert.doesNotMatch(html,/\$50\.00/)
    handleSiteAction(deck,1,'favorite','1')
    assert.match(renderSiteCase(deck,deck.slides[6],6),/♥ Saved/)
  }
})

test('each added concept has working search, basket, booking and linked photo controls', () => {
  for (const id of ['forest-site','heritage-site','letterpress-site']) {
    const deck = SITE_CASES.find((d: {id:string})=>d.id===id)
    const [name,,price] = deck.siteConfig.items[0]
    handleSiteAction(deck,0,'go','1')
    handleSiteAction(deck,1,'search','',{query:name})
    assert.match(renderSiteCase(deck,deck.slides[1],1),/1 results/)
    assert.deepEqual(handleSiteAction(deck,1,'go','5'),{navigate:5})
    assert.match(renderSiteCase(deck,deck.slides[5],5),/class="rc-photo rc-detail-image" data-rc="go"/)
    handleSiteAction(deck,5,'add','0')
    assert.ok(renderSiteCase(deck,deck.slides[27],27).includes(`$${price}`))
    handleSiteAction(deck,27,'remove','0')
    assert.match(renderSiteCase(deck,deck.slides[27],27),/selection is empty/)
    handleSiteAction(deck,22,'book','',{date:'2027-05-20',time:'12:00',guests:'2'})
    assert.match(renderSiteCase(deck,deck.slides[22],22),/2027-05-20 · 12:00 · 2 guest/)
  }
})

test('new concepts have different structural frames and background palettes', () => {
  const expected = [['pulse-site','rail'], ['signal-site','console'], ['crumb-site','masthead']]
  const palettes = new Set<string>()
  for (const [id,shell] of expected) {
    const deck=SITE_CASES.find((d: {id:string})=>d.id===id)
    assert.ok(deck, id)
    palettes.add(deck.paper.toLowerCase())
    assert.equal(deck.siteConfig.shell, shell)
    for (const [i, slide] of deck.slides.entries()) {
      const html=renderSiteCase(deck,slide,i)
      assert.match(html, new RegExp(`rc-frame-${shell}`))
      assert.match(html,/data-rc="previous"/)
      assert.match(html,/data-rc="next"/)
      for (const match of html.matchAll(/data-rc="go" data-value="(\d+)"/g)) {
        assert.ok(Number(match[1])>=0 && Number(match[1])<deck.slides.length,`${id} screen ${i+1}: broken destination`)
      }
      for (const match of html.matchAll(/<span role="button"[^>]*class="rc-photo[^>]*>/g)) assert.match(match[0],/data-rc="go"/)
    }
  }
  assert.equal(palettes.size, 3)
})

test('each distinct case supports navigation, search, selection, date and calculator interactions', () => {
  for(const id of ['pulse-site','signal-site','crumb-site']) {
    const deck=SITE_CASES.find((d: {id:string})=>d.id===id)
    const [name,,price]=deck.siteConfig.items[0]
    assert.deepEqual(handleSiteAction(deck,0,'go','1'),{navigate:1})
    handleSiteAction(deck,1,'search','',{query:name})
    assert.match(renderSiteCase(deck,deck.slides[1],1),/1 results/)
    handleSiteAction(deck,5,'favorite','0')
    assert.match(renderSiteCase(deck,deck.slides[5],5),/♥ Saved/)
    handleSiteAction(deck,5,'add','0')
    assert.ok(renderSiteCase(deck,deck.slides[27],27).includes(`$${price}`))
    handleSiteAction(deck,27,'remove','0')
    handleSiteAction(deck,22,'book','',{date:'2027-06-12',time:'14:00',guests:'2'})
    assert.match(renderSiteCase(deck,deck.slides[22],22),/2027-06-12 · 14:00 · 2 guest/)
    handleSiteAction(deck,24,'calculate','',{toolQty:'10',toolRate:'3'})
    assert.match(renderSiteCase(deck,deck.slides[24],24),/\$30\.00/)
    assert.deepEqual(handleSiteAction(deck,28,'confirm',''),{refresh:true})
    assert.match(renderSiteCase(deck,deck.slides[28],28),/Choose an item before confirming/)
  }
})

test('latest concepts have unique shells, palettes and valid interactive routes', () => {
  const cases = [['campus-site','campus'],['field-site','field'],['bazaar-site','bazaar']]
  for (const [id,shell] of cases) {
    const deck=SITE_CASES.find((d: {id:string})=>d.id===id)
    assert.ok(deck,id)
    assert.equal(deck.slides.length,30)
    assert.equal(SITE_CASES.filter((d: {paper:string})=>d.paper.toLowerCase()===deck.paper.toLowerCase()).length,1)
    const images=new Set<string>()
    for(const [index,slide] of deck.slides.entries()) {
      const html=renderSiteCase(deck,slide,index)
      assert.match(html,new RegExp(`rc-frame-${shell}`))
      assert.match(html,/data-rc="previous"/)
      assert.match(html,/data-rc="next"/)
      for(const m of html.matchAll(/src="cases\/[^/]+\/(\d\d)\.jpg"/g)) images.add(m[1])
      for(const m of html.matchAll(/data-rc="go" data-value="(\d+)"/g)) assert.ok(+m[1]<deck.slides.length)
      for(const m of html.matchAll(/<span role="button"[^>]*class="rc-photo[^>]*>/g)) assert.match(m[0],/data-rc="go"/)
    }
    assert.equal(images.size,15,id)
    const [name,,price]=deck.siteConfig.items[0]
    assert.deepEqual(handleSiteAction(deck,0,'go','1'),{navigate:1})
    handleSiteAction(deck,1,'search','',{query:name})
    assert.match(renderSiteCase(deck,deck.slides[1],1),/1 results/)
    handleSiteAction(deck,5,'favorite','0')
    assert.match(renderSiteCase(deck,deck.slides[5],5),/♥ Saved/)
    handleSiteAction(deck,5,'add','0')
    assert.ok(renderSiteCase(deck,deck.slides[27],27).includes(`$${price}`))
    handleSiteAction(deck,22,'book','',{date:'2027-07-01',time:'14:00',guests:'2'})
    assert.match(renderSiteCase(deck,deck.slides[22],22),/2027-07-01 · 14:00 · 2 guest/)
    handleSiteAction(deck,24,'calculate','',{toolQty:'3',toolRate:'10'})
    assert.match(renderSiteCase(deck,deck.slides[24],24),/\$30\.00/)
  }
})

test('newest case frames and palettes are distinct and their journeys work', () => {
  for (const [id,shell] of [['freight-site','freight'],['listening-site','listening'],['living-site','living']]) {
    const deck=SITE_CASES.find((d: {id:string})=>d.id===id)
    assert.ok(deck,id)
    assert.equal(deck.slides.length,30)
    assert.equal(SITE_CASES.filter((d: {paper:string})=>d.paper.toLowerCase()===deck.paper.toLowerCase()).length,1)
    for(const [i,slide] of deck.slides.entries()) {
      const html=renderSiteCase(deck,slide,i)
      assert.match(html,new RegExp(`rc-frame-${shell}`))
      for(const m of html.matchAll(/data-rc="go" data-value="(\d+)"/g)) assert.ok(+m[1]<deck.slides.length)
      for(const m of html.matchAll(/<span role="button"[^>]*class="rc-photo[^>]*>/g)) assert.match(m[0],/data-rc="go"/)
    }
    const [name,,price]=deck.siteConfig.items[0]
    assert.deepEqual(handleSiteAction(deck,0,'go','1'),{navigate:1})
    handleSiteAction(deck,1,'search','',{query:name})
    assert.match(renderSiteCase(deck,deck.slides[1],1),/1 results/)
    handleSiteAction(deck,5,'favorite','0')
    assert.match(renderSiteCase(deck,deck.slides[5],5),/♥ Saved/)
    handleSiteAction(deck,5,'add','0')
    assert.ok(renderSiteCase(deck,deck.slides[27],27).includes(`$${price}`))
    handleSiteAction(deck,22,'book','',{date:'2027-08-01',time:'14:00',guests:'2'})
    assert.match(renderSiteCase(deck,deck.slides[22],22),/2027-08-01 · 14:00 · 2 guest/)
    handleSiteAction(deck,24,'calculate','',{toolQty:'3',toolRate:'10'})
    assert.match(renderSiteCase(deck,deck.slides[24],24),/\$30\.00/)
  }
})

test('collection concepts have distinct shells and functional connected journeys', () => {
  for (const [id,shell] of [['archive-site','archive'],['maker-site','maker'],['urban-site','urban']]) {
    const deck=SITE_CASES.find((d: {id:string})=>d.id===id)
    assert.ok(deck,id)
    assert.equal(deck.slides.length,30)
    assert.equal(SITE_CASES.filter((d: {paper:string})=>d.paper.toLowerCase()===deck.paper.toLowerCase()).length,1)
    for(const [i,slide] of deck.slides.entries()) {
      const html=renderSiteCase(deck,slide,i)
      assert.match(html,new RegExp(`rc-frame-${shell}`))
      assert.match(html,/data-rc="next"/)
      for(const m of html.matchAll(/data-rc="go" data-value="(\d+)"/g)) assert.ok(+m[1]<deck.slides.length)
      for(const m of html.matchAll(/<span role="button"[^>]*class="rc-photo[^>]*>/g)) assert.match(m[0],/data-rc="go"/)
    }
    const [name,,price]=deck.siteConfig.items[0]
    assert.deepEqual(handleSiteAction(deck,0,'go','1'),{navigate:1})
    handleSiteAction(deck,1,'search','',{query:name})
    assert.match(renderSiteCase(deck,deck.slides[1],1),/1 results/)
    handleSiteAction(deck,5,'favorite','0')
    assert.match(renderSiteCase(deck,deck.slides[5],5),/♥ Saved/)
    handleSiteAction(deck,5,'add','0')
    assert.ok(renderSiteCase(deck,deck.slides[27],27).includes(`$${price}`))
    handleSiteAction(deck,22,'book','',{date:'2027-09-01',time:'14:00',guests:'2'})
    assert.match(renderSiteCase(deck,deck.slides[22],22),/2027-09-01 · 14:00 · 2 guest/)
    handleSiteAction(deck,24,'calculate','',{toolQty:'3',toolRate:'10'})
    assert.match(renderSiteCase(deck,deck.slides[24],24),/\$30\.00/)
    handleSiteAction(deck,24,'calculate','',{toolQty:'-1',toolRate:'10'})
    assert.match(renderSiteCase(deck,deck.slides[24],24),/Enter a whole number/)
  }
})
