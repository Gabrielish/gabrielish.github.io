const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});let count=2,events=0,offline=false;
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.route('**/functions/v1/bg3ro-statistics',async r=>{
    if(offline)return r.abort();
    if(r.request().method()==='POST'){assert.equal(r.request().postDataJSON().action,'download');events++;count++;return r.fulfill({json:{counted:true}});}
    return r.fulfill({json:{nexus_downloads:23,site_downloads:count,nexus_views:906,site_views:4,views_observed_at:'2026-10-18',downloads_synced_at:new Date().toISOString(),sync_ok:true}});
  });
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('bg3ro:auth',{detail:{client:{},moderator:false,userId:null}})));
  assert.equal(await page.locator('#statistics-downloads').textContent(),'25');assert.equal(await page.locator('#statistics-views').textContent(),'910');
  assert.equal(await page.locator('.sidebar-statistics dl>div').count(),3);
  assert.equal(await page.locator('.sidebar-statistics p').count(),0);
  assert.equal(await page.locator('#statistics-ratings,#statistics-compatibility,#statistics-sync,#statistics-views-source').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{const a=document.createElement('a');a.href='#test-download';a.dataset.releaseId='11111111-1111-1111-1111-111111111111';a.id='test-download-anchor';a.textContent='Test download';document.body.append(a);});
  await page.locator('#test-download-anchor').click();await page.waitForFunction(()=>document.getElementById('statistics-downloads').textContent==='26');assert.equal(events,1);
  await page.locator('#test-download-anchor').click();assert.equal(events,1);
  await page.evaluate(()=>{const a=document.createElement('a');a.href='#test-nexus';a.id='test-nexus';a.textContent='Nexus';document.body.append(a);});
  await page.locator('#test-nexus').click();assert.equal(events,1);
  offline=true;await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#statistics-downloads').textContent(),'—');
  await page.close();
 }console.log('PASS: responsive statistics, totals, honest views, native clicks, duplicate suppression, Nexus excluded, offline state.');}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
