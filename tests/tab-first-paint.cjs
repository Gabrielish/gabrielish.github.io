const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [390,1440])for(const route of ['actualizari','descarcari','discutii','erori','despre','setari/profil','necunoscut']){
  const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
   localStorage.setItem('bg3ro-cookie-preferences',JSON.stringify({version:1,analytics:false,updatedAt:Date.now()}));
   localStorage.setItem('bg3ro-public-v1:about',JSON.stringify({time:Date.now(),origin:'https://test.supabase.co',value:{data:[{id:'progress',kind:'progress',title:'Progresul traducerii',body:null,is_visible:true,sort_order:1,translation_percent:79.67,review_percent:20,testing_percent:20}],count:1}}));
   window.__tabFrames=[];window.__watchTabs=true;
   function sample(){window.__tabFrames.push([...document.querySelectorAll('.tab-panel')].filter(el=>el.checkVisibility()).map(el=>el.id));if(window.__watchTabs)requestAnimationFrame(sample);}
   requestAnimationFrame(sample);
  });
  await p.route('https://baldursgate3.game/**',r=>r.abort());await p.route('https://test.supabase.co/**',r=>r.abort());await p.route('https://esm.sh/**',r=>r.abort());
  await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'sb_publishable_qa'};"}));
  let release;const gate=new Promise(resolve=>release=resolve);
  await p.route('**/portal.js?*',async r=>{await gate;await r.continue();});
  await p.goto('http://127.0.0.1:4173/#'+route,{waitUntil:'commit'});
  await p.waitForFunction(()=>document.querySelector('#translation-percent')?.textContent==='79.67%');
  assert.equal(await p.evaluate(()=>!!document.querySelector('#initial-tab-visibility')),true,'Deferred router must still be blocked');
  const expected=route==='necunoscut'?'despre':route.split('/')[0];
  const visible=()=>p.locator('.tab-panel').evaluateAll(els=>els.filter(el=>el.checkVisibility()).map(el=>el.id));
  assert.deepEqual(await visible(),expected==='setari'?[]:[expected],'First paint must match URL even while public About renders');
  await p.waitForTimeout(100);release();await p.waitForSelector('html.portal-ready');
  await p.evaluate(()=>window.__watchTabs=false);
  assert.deepEqual(await visible(),expected==='setari'?[]:[expected]);
  assert.equal(await p.locator('#initial-tab-visibility').count(),0,'Bootstrap rule is removed when normal routing takes over');
  const frames=await p.evaluate(()=>window.__tabFrames);assert(frames.length>0);assert(frames.every(ids=>ids.every(id=>id===expected)),'Another tab flashed during initialization');
  await p.locator('#tab-despre').click();assert.deepEqual(await visible(),['despre']);await p.locator('#tab-erori').click();assert.deepEqual(await visible(),['erori']);
  assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS initial URL routing before deferred scripts, cached progress, nested/invalid hashes and subsequent tab navigation at 390/1440px');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
