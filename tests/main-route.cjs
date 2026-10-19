const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const base=process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/';
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const failures=[];page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)failures.push(r.url())});
    await page.goto(base,{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
    assert.equal(await page.locator('h1').textContent(),'Baldur’s Gate 3');
    assert.equal(await page.locator('[role=tab]:visible').count(),5);
    assert((await page.locator('meta[name=robots]').getAttribute('content')).startsWith('index,'));
    assert.equal(await page.locator('.boot-message').count(),0,'No preview notice on home');
    assert.equal(await page.locator('[src^="../"],[href^="../"]').count(),0);
    assert.deepEqual(failures,[]);
    await page.goto(new URL('portal/?v=redirect-test#descarcari',base).href,{waitUntil:'networkidle'});
    await page.waitForURL(url=>url.pathname===new URL(base).pathname&&url.hash==='#descarcari');
    assert.equal(new URL(page.url()).search,'?v=redirect-test');
    assert(await page.locator('#descarcari').isVisible());await page.close();
    const noJS=await browser.newPage({javaScriptEnabled:false,reducedMotion:'reduce'});
    await noJS.goto(new URL('portal/',base).href,{waitUntil:'networkidle'});
    await noJS.waitForURL(url=>url.pathname===new URL(base).pathname);
    assert.equal(await noJS.locator('h1').textContent(),'Baldur’s Gate 3');await noJS.close();
    console.log('PASS: new homepage, local assets, indexable canonical page, preview redirect keeps query/tab, no-JS redirect.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
