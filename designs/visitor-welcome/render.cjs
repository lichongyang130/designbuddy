/* Render the 15 hand-authored UI concepts. No model request or paid generation. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('../../apps/web/node_modules/@playwright/test');
const sharp = require('sharp');
const folder = __dirname;
(async () => {
  const data = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(folder, 'concepts.js'), 'utf8'), data);
  const concepts = data.window.WELCOME_CONCEPTS.filter(c=>c.artState==='generated');
  const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH} : {}), args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  const results=[];
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  fs.mkdirSync(path.join(folder,'png'),{recursive:true});
  fs.mkdirSync(path.join(folder,'thumb'),{recursive:true});
  for(const c of concepts){
    await page.goto(`${process.env.DESIGN_PREVIEW_URL || 'http://127.0.0.1:5180'}/concept.html?v=${c.id}`);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(img=>img.decode()));});
    const checks=await page.evaluate(()=>{
      const h=document.querySelector('h1'),primary=document.querySelector('.primary'),r=h.getBoundingClientRect(),b=primary.getBoundingClientRect(),copy=document.querySelector('.copy').getBoundingClientRect(),brand=document.querySelector('.brand').getBoundingClientRect(),footer=document.querySelector('.footer').getBoundingClientRect(),body=document.querySelector('.body').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,verticalOverflow:document.documentElement.scrollHeight>innerHeight,titleFits:h.scrollWidth<=h.clientWidth+1,titleWithinWindow:r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight,buttonWithinWindow:b.x>=0&&b.right<=innerWidth&&b.y>=0&&b.bottom<=innerHeight,brandBodyOverlap:brand.width>0&&brand.bottom>body.top,footerBodyOverlap:footer.width>0&&body.bottom>footer.top,fontLoaded:document.fonts.check('16px WelcomeSans')};
    });
    if(checks.horizontalOverflow||checks.verticalOverflow||!checks.titleFits||!checks.titleWithinWindow||!checks.buttonWithinWindow||checks.brandBodyOverlap||checks.footerBodyOverlap||!checks.fontLoaded)throw Error('Layout failed '+c.id+' '+JSON.stringify(checks));
    const filename=`${String(c.id).padStart(2,'0')}-${c.name}.png`;
    await page.screenshot({path:path.join(folder,'png',filename),animations:'disabled'});
    await sharp(path.join(folder,'png',filename)).resize({width:720}).webp({quality:84}).toFile(path.join(folder,'thumb',String(c.id).padStart(2,'0')+'.webp'));
    results.push({id:c.id,name:c.name,file:'png/'+filename,checks});
    console.log('EXPORTED',filename);
  }
  await browser.close();
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(folder,'layout-checks.json'),JSON.stringify({date:'2026-10-19',revision:2,completed:concepts.length,pending:15-concepts.length,scope:'Desktop design-concept renders, not application/functional acceptance.',engine:'Chromium',count:results.length,pageErrors:errors,results},null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1)});
