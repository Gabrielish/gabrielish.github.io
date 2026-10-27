const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const mode of ['guest','member','moderator']){
  const page=await browser.newPage();let views=0,authorization=null;
  await page.route('https://gabrielish.github.io/**',r=>r.fulfill({contentType:'text/html',body:'<dd id="statistics-downloads"></dd><dd id="statistics-views"></dd>'}));
  await page.route('**/functions/v1/bg3ro-statistics',r=>{
    if(r.request().method()==='POST'){assert.equal(r.request().postDataJSON().action,'view');authorization=r.request().headers().authorization;views++;return r.fulfill({json:{counted:true}});}
    return r.fulfill({json:{nexus_downloads:23,site_downloads:0,nexus_views:906,site_views:views}});
  });
  await page.goto('https://gabrielish.github.io/');
  await page.evaluate(()=>window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'});
  await page.evaluate(()=>window.BG3RO_COOKIES={allowsAnalytics:()=>true});await page.addScriptTag({path:path.resolve('portal-statistics.js')});
  await page.waitForFunction(()=>document.getElementById('statistics-views').textContent==='906');
  assert.equal(views,0,'Wait for restored auth before counting');
  await page.evaluate(mode=>{
    const detail={client:{auth:{getSession:async()=>({data:{session:{access_token:'verified-user-token'}}})}},userId:mode==='guest'?null:'user-id',moderator:mode==='moderator'};
    window.dispatchEvent(new CustomEvent('bg3ro:auth',{detail}));window.dispatchEvent(new CustomEvent('bg3ro:auth',{detail}));
  },mode);
  if(mode!=='moderator'){
    await page.waitForFunction(()=>document.getElementById('statistics-views').textContent==='907');
    assert.equal(views,1,'One view despite multiple Auth events');
    assert.equal(authorization,mode==='member'?'Bearer verified-user-token':undefined);
    await page.evaluate(()=>location.hash='descarcari');assert.equal(views,1);
  }else{await page.waitForTimeout(150);assert.equal(views,0,'Moderator sends no view');}
  await page.close();
 }console.log('PASS: guest/member view events, JWT forwarding, auth restore ordering, admin exclusion, no duplicate Auth/tab views.');}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
