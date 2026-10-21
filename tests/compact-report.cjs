const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://baldursgate3.game/**',r=>r.abort());await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={};'}));
  await page.goto('http://127.0.0.1:4173/#erori',{waitUntil:'networkidle'});
  await page.locator('#report-form').evaluate(el=>el.hidden=false);await page.locator('#report-name').fill('Jucător');
  assert.equal(await page.locator('#report-game,[name=game_version]').count(),0);
  assert.equal(await page.locator('#reports-heading').count(),0);
  assert.equal(await page.locator('#erori > .card').count(),1,'Form and reports share one card');
  assert(await page.locator('#reports-list').evaluate(el=>el.closest('.card')===document.querySelector('#report-form').closest('.card')));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('bg3ro:releases-updated',{detail:{versions:['v0.8.0','v0.7.9','v.0.8.0','v0.7.0','V0.8.0']}})));
  assert.deepEqual(await page.locator('#report-version option').evaluateAll(nodes=>nodes.map(n=>n.value)),['','v0.7.9','v0.7.0','Nespecificată']);
  await page.locator('#report-version').selectOption('v0.7.0');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('bg3ro:releases-updated',{detail:{versions:['v0.9.0','v0.8.0','v0.7.0']}})));
  assert.equal(await page.locator('#report-version').inputValue(),'v0.7.0');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('bg3ro:releases-unavailable')));
  assert.equal(await page.locator('#report-version').inputValue(),'v0.7.0');
  const formBox=await page.locator('#report-form').boundingBox();if(width===1440)assert(formBox.height<650,'Compact desktop form including optional photo');
  assert.equal(await page.locator('[name=public_consent]').count(),0);
  assert.equal(await page.locator('#report-form .help').count(),1);
  assert.equal(await page.locator('#report-photo').count(),1);
  assert.equal(await page.locator('label[for=report-body]').textContent(),'Descrie problema');
  const description=page.locator('#report-body'),photo=page.locator('#report-photo-drop'),photoLabel=page.locator('label[for=report-photo]');
  const descriptionBox=await description.boundingBox(),photoBox=await photo.boundingBox(),labelBox=await photoLabel.boundingBox();
  assert(labelBox.y+labelBox.height<=photoBox.y,'Photo label is above the box');
  if(width>600){assert(photoBox.x>=descriptionBox.x+descriptionBox.width,'Photo is on the right');assert(Math.abs(photoBox.y-descriptionBox.y)<2,'Boxes align');}
  if(width>600){
   const versionBox=await page.locator('#report-version').boundingBox();
   assert(Math.abs(photoBox.x-versionBox.x)<1,'Photo aligns with version column');
   assert(Math.abs(photoBox.width-versionBox.width)<1,'Photo matches version width');
  }
  if(width>950){
   const kindBox=await page.locator('#report-kind').boundingBox(),platformBox=await page.locator('#report-platform').boundingBox();
   assert(Math.abs(descriptionBox.x-kindBox.x)<1);
   assert(Math.abs(descriptionBox.x+descriptionBox.width-platformBox.x-platformBox.width)<1,'Description spans two columns');
  }
  const borders=await page.locator('#report-body,#report-photo-drop').evaluateAll(nodes=>nodes.map(el=>{const s=getComputedStyle(el);return [s.borderTopColor,s.borderTopStyle,s.borderTopWidth,s.borderTopLeftRadius,s.backgroundColor]}));
  assert.deepEqual(borders[0],borders[1],'Photo and description share border, radius and background');
  await description.fill(('Un text lung pentru testarea scrollului.\n').repeat(100));
  const scroll=await description.evaluate(el=>({resize:getComputedStyle(el).resize,overflow:getComputedStyle(el).overflowY,content:el.scrollHeight,visible:el.clientHeight}));
  assert.equal(scroll.resize,'none');assert.equal(scroll.overflow,'auto');assert(scroll.content>scroll.visible);
  assert.equal((await description.boundingBox()).height,descriptionBox.height,'Long text does not enlarge textarea');
  await description.fill('');
  assert.equal(await page.locator('#report-photo').getAttribute('name'),null,'Photo is handled separately from report text');
  assert(!(await page.locator('.report-compose > p.small').textContent()).includes('Raportările noi sunt publice'));
  assert((await page.locator('.report-compose > p.small').textContent()).startsWith('Un text greșit, un acord nepotrivit sau o problemă tehnică?'));
  const nameBox=await page.locator('#report-name').boundingBox(),subjectBox=await page.locator('#report-title').boundingBox();
  assert(subjectBox.y>=nameBox.y+nameBox.height,'Subject occupies its own row');assert.equal(subjectBox.width,nameBox.width);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await page.locator('.report-compose').screenshot({path:`.qa/compact-report-${width}.png`});await page.close();
 }
 console.log('PASS: report layout 320–1440px, restored introduction, full-width subject, redundant note/checkbox removed, published-version dropdown and selection preserved.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
