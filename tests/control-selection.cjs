const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={};'}));
  await page.goto('http://127.0.0.1:4173/#descarcari',{waitUntil:'networkidle'});
  const summary=page.locator('#install-windows summary');
  await summary.click({clickCount:3});
  assert.equal(await page.evaluate(()=>getSelection().toString()),'','Repeated summary clicks do not select the title or content');
  await summary.evaluate(el=>el.parentElement.open=true);
  const box=await summary.boundingBox();
  await page.mouse.move(box.x+24,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+Math.min(box.width-20,220),box.y+box.height+50,{steps:10});await page.mouse.up();
  assert.equal(await page.evaluate(()=>getSelection().toString()),'','Dragging from the summary cannot select the expanded content');
  await summary.focus();await page.keyboard.press('Enter');assert.equal(await summary.evaluate(el=>el.parentElement.open),false);
  await page.keyboard.press('Space');assert.equal(await summary.evaluate(el=>el.parentElement.open),true);
  const path=page.locator('#install-windows .installation-path').first();
  await path.click({clickCount:3});
  assert((await page.evaluate(()=>getSelection().toString())).includes('Localization'),'Installation paths remain selectable');
  await page.evaluate(()=>getSelection().removeAllRanges());
  await page.locator('#tab-despre').click();
  await page.locator('.compatibility-fields').evaluate(el=>{el.hidden=false;document.querySelector('#compatibility-vote-form').hidden=false;document.querySelector('#compatibility-vote-body').hidden=false;});
  const select=page.locator('#compatibility-platform');
  assert.equal(await select.evaluate(el=>getComputedStyle(el).userSelect),'none');
  assert.equal(await select.locator('option').first().evaluate(el=>getComputedStyle(el).userSelect),'none');
  await select.click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  assert.equal(await select.inputValue(),'macos');
  assert.equal(await page.evaluate(()=>getSelection().toString()),'','Picker interaction does not select page text');
  await page.close();
 }console.log('PASS: repeated accordion clicks/drag, keyboard toggling, selectable installation paths and dropdown keyboard input (mobile/desktop).');}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
