const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://baldursgate3.game/**',r=>r.abort());await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={};'}));
  await page.goto('http://127.0.0.1:4173/#erori',{waitUntil:'networkidle'});
  await page.locator('#report-form').evaluate(el=>el.hidden=false);await page.locator('#report-name').fill('Jucător');
  assert.equal(await page.locator('#report-game,[name=game_version]').count(),0);
  assert.equal(await page.locator('#reports-heading').textContent(),'Erori raportate');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('bg3ro:releases-updated',{detail:{versions:['v0.8.0','v0.7.0','V0.8.0']}})));
  assert.deepEqual(await page.locator('#report-version option').evaluateAll(nodes=>nodes.map(n=>n.value)),['','v0.8.0','v0.7.0','Nespecificată']);
  await page.locator('#report-version').selectOption('v0.7.0');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('bg3ro:releases-updated',{detail:{versions:['v0.9.0','v0.8.0','v0.7.0']}})));
  assert.equal(await page.locator('#report-version').inputValue(),'v0.7.0');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('bg3ro:releases-unavailable')));
  assert.equal(await page.locator('#report-version').inputValue(),'v0.7.0');
  const formBox=await page.locator('#report-form').boundingBox();if(width===1440)assert(formBox.height<470,'Compact desktop form');
  assert.equal(await page.locator('[name=public_consent]').count(),0);
  assert.equal(await page.locator('#report-form .help').count(),0);
  assert((await page.locator('.report-compose > p.small').textContent()).startsWith('Un text greșit, un acord nepotrivit sau o problemă tehnică?'));
  const nameBox=await page.locator('#report-name').boundingBox(),subjectBox=await page.locator('#report-title').boundingBox();
  assert(subjectBox.y>=nameBox.y+nameBox.height,'Subject occupies its own row');assert.equal(subjectBox.width,nameBox.width);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await page.locator('.report-compose').screenshot({path:`.qa/compact-report-${width}.png`});await page.close();
 }
 console.log('PASS: report layout 320–1440px, restored introduction, full-width subject, redundant note/checkbox removed, published-version dropdown and selection preserved.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
