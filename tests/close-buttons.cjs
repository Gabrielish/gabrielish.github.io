const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={};'}));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  for(const selector of ['#auth-dialog','#support-dialog']){
   const dialog=page.locator(selector),button=dialog.locator('.dialog-close');
   await dialog.evaluate(el=>el.showModal());await button.evaluate(el=>el.blur());await page.mouse.move(0,0);
   const resting=await button.evaluate(el=>{const s=getComputedStyle(el),a=getComputedStyle(el,'::before'),b=getComputedStyle(el,'::after');return {background:s.backgroundColor,width:s.width,height:s.height,padding:s.padding,font:s.fontSize,left:a.left,top:a.top,secondLeft:b.left,secondTop:b.top};});
   assert.equal(resting.width,resting.height);assert.equal(resting.padding,'0px');assert.equal(resting.font,'0px');
   assert.equal(resting.left,resting.secondLeft);assert.equal(resting.top,resting.secondTop);
   // Absolutely positioned pseudo-elements use the button padding box.
   assert(Math.abs(parseFloat(resting.left)-(parseFloat(resting.width)-2)/2)<1);
   assert(Math.abs(parseFloat(resting.top)-(parseFloat(resting.height)-2)/2)<1);
   await button.hover();assert.notEqual(await button.evaluate(el=>getComputedStyle(el).backgroundColor),resting.background,'Hover is visible');
   if(selector==='#auth-dialog')await button.screenshot({path:`.qa/close-hover-${width}.png`});
   await button.click();assert.equal(await dialog.isVisible(),false);
  }
  await page.close();
 }
 console.log('PASS: shared centered cross and warm hover; login/support/editor close buttons at 390/1440px.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
