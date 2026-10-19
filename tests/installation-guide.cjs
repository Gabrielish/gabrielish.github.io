const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [320,390,820,1440]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://baldursgate3.game/**',r=>r.abort());
   await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={};'}));
   await page.goto('http://127.0.0.1:4173/#descarcari',{waitUntil:'networkidle'});
   const guide=page.locator('#installation-guide');
   assert(await guide.isVisible());
   assert.equal(await guide.locator('.installation-platform').count(),3);
   const panelColors=await guide.locator('.installation-platform,.installation-backup').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor));
   assert.deepEqual(panelColors,Array(4).fill('rgb(24, 25, 25)'),'Windows, macOS, PS5 and backup match release notes');
   assert.equal(await guide.locator('.installation-platform summary svg,.installation-platform summary img,#install-ps5 img').count(),3);
   for(const platform of ['windows','macos']){
    assert.equal(await guide.locator(`#install-${platform} .installation-content section`).count(),2);
    assert.equal(await guide.locator(`#install-${platform}-localization`).textContent(),'Localizare');
    assert.equal(await guide.locator(`#install-${platform}-mods`).textContent(),'Moduri suplimentare');
   }
   assert((await page.locator('#install-windows-localization + ol').textContent()).includes('Data\\Localization'));
   assert((await page.locator('#install-macos-localization + ol').textContent()).includes('Contents/Data/Localization'));
   assert.equal(await page.locator('#install-ps5 .installation-status').textContent(),'În curând');
   assert((await page.locator('.installation-backup').textContent()).includes('copie'));
   assert((await page.locator('#install-windows-mods').locator('..').textContent()).includes('Nu pune English.pak în acest folder'));
   assert((await page.locator('#install-macos-mods').locator('..').textContent()).includes('nu este încă confirmată'));
   const summary=page.locator('#install-macos summary');await summary.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#install-macos').getAttribute('open'),null);
   await page.keyboard.press('Enter');assert.notEqual(await page.locator('#install-macos').getAttribute('open'),null);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(errors,[]);
   if(width===390||width===1440){await summary.blur();await guide.screenshot({path:`.qa/installation-guide-${width}.png`,style:'.topbar,.skip-link{visibility:hidden!important}'});}
   await page.close();
  }
  const page=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:900}});
  await page.goto('http://127.0.0.1:4173/#descarcari');assert(await page.locator('#installation-guide').isVisible());
  await page.locator('#install-windows summary').click();assert.equal(await page.locator('#install-windows').getAttribute('open'),null);
  await page.close();console.log('PASS: platform logos, separate localization/mods, source paths, PS5 coming soon, responsive 320–1440, keyboard/native no-JS details.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
