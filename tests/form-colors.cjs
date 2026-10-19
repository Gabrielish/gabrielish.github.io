const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:1000}});
   await page.route('https://baldursgate3.game/**',r=>r.abort());
   await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={};'}));
   await page.goto('http://127.0.0.1:4173/#descarcari',{waitUntil:'networkidle'});
   await page.locator('#release-editor').evaluate(el=>el.hidden=false);
   await page.locator('#release-editor > details').evaluate(el=>el.open=true);
   const field=page.locator('#release-version');
   await field.fill('v.0.0.1');
   assert.equal(await field.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(24, 25, 25)');
   assert.equal(await field.evaluate(el=>getComputedStyle(el).borderColor),'rgb(215, 188, 138)');
   const session=await page.context().newCDPSession(page);
   await session.send('DOM.enable');await session.send('CSS.enable');
   const {root}=await session.send('DOM.getDocument');
   const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#release-version'});
   await session.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['autofill','focus']});
   const style=await field.evaluate(el=>{const s=getComputedStyle(el);return {shadow:s.boxShadow,text:s.webkitTextFillColor,selection:getComputedStyle(el,'::selection').backgroundColor}});
   assert(style.shadow.includes('rgb(24, 25, 25)')&&style.shadow.includes('inset'),'Autofill covered with neutral surface');
   assert.equal(style.text,'rgb(240, 229, 209)');
   assert.equal(style.selection,'rgb(81, 70, 50)');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('#release-publish-form').screenshot({path:`.qa/form-colors-${width}.png`});
   await page.close();
  }
  console.log('PASS: neutral fields, gold focus, warm selection and Chromium autofill at mobile/desktop widths.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
