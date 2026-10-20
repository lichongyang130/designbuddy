import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await page.goto('http://127.0.0.1:5173/inspiration', { waitUntil: 'networkidle0' });
    console.log('Page loaded');
    await browser.close();
  } catch(e) {
    console.log("Puppeteer error", e);
  }
})();
