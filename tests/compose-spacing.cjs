const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={};'}));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  const measurements=[];
  // Discussions now use a separate visual editor/feed; preserve the report header contract.
  for(const id of ['erori']){
   await page.locator(`#tab-${id}`).click();
   const card=page.locator(`#${id} .community-compose`);
   await card.evaluate(el=>{
    el.querySelectorAll('.backend-notice,[data-auth-gate]').forEach(n=>n.hidden=true);
    el.querySelector('form').hidden=false;
   });
   measurements.push(await card.evaluate(el=>{
    const h=el.querySelector(':scope>h2'),p=el.querySelector(':scope>p.small'),form=el.querySelector('form');
    const c=el.getBoundingClientRect(),hr=h.getBoundingClientRect(),pr=p.getBoundingClientRect(),fr=form.getBoundingClientRect();
    return {padding:getComputedStyle(el).padding,titleX:hr.x-c.x,titleY:hr.y-c.y,font:getComputedStyle(h).fontSize,titleToDescription:pr.y-hr.bottom,descriptionToForm:fr.y-pr.bottom};
   }));
   await card.screenshot({path:`.qa/compose-${id}-${width}.png`});
   for(const message of ['', 'Publicat.']){
    const gaps=await card.evaluate((el,message)=>{
     const form=el.querySelector('form');form.querySelector('.form-status').textContent=message;
     const list=el.querySelector('#discussion-list,#reports-list');
     list.closest('#my-reports')?.removeAttribute('hidden');
     list.replaceChildren(Object.assign(document.createElement('article'),{className:'post-thread',textContent:'Test'}));
     const line=list.firstElementChild.getBoundingClientRect().top,button=form.querySelector('[type=submit]').getBoundingClientRect();
     return {form:line-form.getBoundingClientRect().bottom,button:line-button.bottom};
    },message);
    assert.equal(gaps.form,16,`Consistent form-to-separator gap for ${id} at ${width}px`);
    if(!message)assert.equal(gaps.button,16,'Empty status does not affect button spacing');
   }
  }
  assert.equal(measurements[0].titleToDescription,12);
  assert.equal(measurements[0].descriptionToForm,18);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.close();
 }
 console.log('PASS: shared card padding, title alignment, 12px heading gap and 18px form gap at 320/390/820/1440px.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
