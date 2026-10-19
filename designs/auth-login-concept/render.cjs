const { chromium } = require('../../apps/web/node_modules/@playwright/test');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await page.goto(pathToFileURL(resolve(__dirname,'index.html')).href);
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('.scene').evaluate(async e=>{const url=getComputedStyle(e).backgroundImage.match(/url\("?([^"\)]+)"?\)/)[1];const i=new Image();i.src=url;await i.decode()});
 const check=await page.evaluate(()=>{const p=document.querySelector('.panel').getBoundingClientRect();return {width:innerWidth,height:innerHeight,panelBottom:p.bottom,footerBottom:document.querySelector('.footer').getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth}});
 if(check.overflow||check.footerBottom>check.panelBottom)throw Error(JSON.stringify(check));
 await page.screenshot({path:resolve(__dirname,'07-登录布局重新设计.png')});
 console.log(check);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
