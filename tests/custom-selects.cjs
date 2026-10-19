const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={};'}));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  const select=page.locator('#compatibility-platform');
  const alignment=await select.evaluate(el=>{const s=getComputedStyle(el),i=getComputedStyle(el,'::picker-icon');return{align:s.alignItems,line:s.lineHeight,iconAlign:i.alignSelf,top:i.marginTop,bottom:i.marginBottom};});
  assert.equal(alignment.align,'center');assert.equal(alignment.iconAlign,'center');assert.equal(alignment.line,'20px');assert.equal(alignment.top,'0px');assert.equal(alignment.bottom,'0px');
  await select.scrollIntoViewIfNeeded();
  await page.locator('.compatibility-fields').screenshot({path:`.qa/centered-selects-${width}.png`});
  await select.click();
  assert(await select.evaluate(el=>el.matches(':open')));
  const style=await select.evaluate(el=>{const s=getComputedStyle(el),p=getComputedStyle(el,'::picker(select)'),i=getComputedStyle(el,'::picker-icon');return{appearance:s.appearance,background:p.backgroundColor,color:p.color,width:p.width,arrow:i.transform,animation:p.animationName};});
  assert.equal(style.appearance,'base-select');assert.equal(style.background,'rgb(24, 25, 25)');assert.equal(style.arrow,'matrix(-1, 0, 0, -1, 0, 0)');assert.equal(style.animation,'none');
  const field=await select.boundingBox(),option=await select.locator('option').first().boundingBox();
  assert(Math.abs(parseFloat(style.width)-field.width)<1);assert(option.x>=field.x&&option.x+option.width<=field.x+field.width);
  await page.screenshot({path:`.qa/custom-select-${width}.png`});
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await select.inputValue(),'macos');assert.equal(await select.evaluate(el=>el.matches(':open')),false);
  await select.click();await page.keyboard.press('Escape');assert.equal(await select.inputValue(),'macos');
  await select.click();await page.mouse.click(1,900);assert.equal(await select.evaluate(el=>el.matches(':open')),false);
  await page.locator('#tab-descarcari').click();
  await page.locator('#release-editor').evaluate(el=>el.hidden=false);await page.locator('#release-editor > details').evaluate(el=>el.open=true);
  await page.locator('#release-kind').click();await page.locator('#release-kind option[value=item_gender]').click();assert.equal(await page.locator('#release-kind').inputValue(),'item_gender');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.close();
 }
 console.log('PASS: themed attached native pickers, rotating chevron, keyboard choice, Escape/outside click, dynamic fields and 320–1440px.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
