const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const mode of ['guest','member','moderator','session-error']){
      const page=await browser.newPage();const events=[];
      await page.route('http://127.0.0.1:4173/**',r=>r.fulfill({contentType:'text/html',body:'<a href="#file" data-release-id="11111111-1111-1111-1111-111111111111">Download</a>'}));
      await page.route('https://stats.test/**',r=>{
        if(r.request().method()==='POST')events.push(r.request().headers());
        return r.fulfill({json:{nexus_downloads:0,site_downloads:0,nexus_views:0,site_views:0}});
      });
      await page.goto('http://127.0.0.1:4173/');
      await page.evaluate(()=>window.BG3RO_CONFIG={supabaseUrl:'https://stats.test',supabasePublishableKey:'test'});
      await page.addScriptTag({path:path.resolve('portal-statistics.js')});
      await page.locator('a').click();assert.equal(events.length,0,'Wait for restored identity');
      assert(page.url().endsWith('#file'),'Native navigation remains available');
      await page.evaluate(mode=>window.dispatchEvent(new CustomEvent('bg3ro:auth',{detail:{
        moderator:mode==='moderator',userId:mode==='guest'?null:'member-id',
        client:{auth:{getSession:async()=>mode==='session-error'?{error:true,data:{}}:{data:{session:{access_token:'verified-session'}}}}}
      }})),mode);
      if(mode==='member'||mode==='guest')await Promise.all([page.waitForResponse(r=>r.url().includes('stats.test')&&r.request().method()==='POST'),page.locator('a').click()]);
      else await page.locator('a').click();
      await page.waitForTimeout(150);
      assert.equal(events.length,mode==='guest'||mode==='member'?1:0,mode);
      if(mode==='member')assert.equal(events[0].authorization,'Bearer verified-session');
      if(mode==='guest')assert.equal(events[0].authorization,undefined);
      await page.close();
    }
    console.log('PASS: admin excluded, member JWT, guest counting, auth restoration and session failure; native link preserved.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
