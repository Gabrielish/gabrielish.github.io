const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const A='11111111-1111-4111-8111-111111111111';
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8'),account=fs.readFileSync(require.resolve('./account-settings.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>')).replaceAll("'owner'",JSON.stringify(A));
const accounts=account.slice(account.indexOf('function accountSDK('),account.indexOf('\n(async()=>'));
function restoredSDK(base){
 const state=window.__communityTest,from=base.from;
 base.auth.getSession=async()=>{const session=JSON.parse(localStorage.getItem('bg3ro-auth'));state.user=session?.user||null;return{data:{session},error:null};};
 base.from=table=>{const q=from(table);if(table==='bg3ro_profiles'){const then=q.then;q.then=(resolve,reject)=>new Promise(done=>setTimeout(done,1000)).then(()=>new Promise((done,fail)=>then.call(q,done,fail))).then(resolve,reject);}return q;};
 window.__testNavClient=base;return base;
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [1440,390]){
  const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(id=>{
   localStorage.setItem('bg3ro-auth',JSON.stringify({user:{id,app_metadata:{provider:'discord'},user_metadata:{full_name:'An OLD name'}}}));
   localStorage.setItem('bg3ro-nav-display',JSON.stringify({id,name:'gabrielish',messages:0,contacts:0,notifications:1}));
   sessionStorage.setItem('bg3ro-nav-name:'+id,'Another OLD name');
   localStorage.setItem('bg3ro-cookie-preferences',JSON.stringify({version:1,analytics:false,updatedAt:Date.now()}));
   window.__frames=[];window.__watchNav=true;
   function watch(){const name=document.querySelector('#nav-profile span'),tools=document.querySelector('.nav-account-tools');if(name&&tools)window.__frames.push({name:name.textContent,tools:!tools.hidden,login:document.querySelector('.navbar-actions>[data-auth-open]').checkVisibility({visibilityProperty:true}),guestFields:[...document.querySelectorAll('.discussion-identity,.report-guest-name')].some(el=>getComputedStyle(el).display!=='none'),badge:document.querySelector('#nav-notifications .nav-account-count').textContent});if(window.__watchNav)requestAnimationFrame(watch);}
   requestAnimationFrame(watch);
  },A);
  await p.route('https://baldursgate3.game/**',r=>r.abort());
  await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'}"}));
  await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${restoredSDK})((${accounts})((${sdk})()));`}));
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await p.route('**/portal-community-profiles.js*',async r=>{await gate;await r.continue();});
  await p.goto('http://127.0.0.1:4173/',{waitUntil:'commit'});
  await p.waitForFunction(()=>document.querySelector('#nav-profile span')?.textContent==='gabrielish');
  assert.equal(await p.evaluate(()=>window.__communityTest),undefined,'Navbar must already be restored before the SDK and deferred account scripts run');
  await p.waitForFunction(()=>document.querySelector('.report-guest-name'));
  for(const selector of ['.discussion-identity','.report-guest-name'])assert.equal(await p.locator(selector).evaluate(el=>getComputedStyle(el).display),'none','Member name field is hidden before SDK restoration');
  assert.equal(await p.locator('#nav-notifications .nav-account-count').textContent(),'1');
  assert.equal(await p.locator('.navbar-actions>[data-auth-open]').isVisible(),false);
  const rect=selector=>p.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
  await p.evaluate(()=>document.fonts.ready);
  const before=await rect(width>1100?'.nav-account-tools':'.topbar-inner');
  await p.locator('.topbar').screenshot({path:'.qa/nav-before-auth-'+width+'.png'});
  release();await p.waitForSelector('html.portal-ready');await p.waitForTimeout(1300);
  const after=await rect(width>1100?'.nav-account-tools':'.topbar-inner');
  for(const key of ['x','y','width','height'])assert(Math.abs(before[key]-after[key])<1,'Navbar geometry changed during restoration: '+key);
  await p.evaluate(()=>dispatchEvent(new CustomEvent('bg3ro:auth',{detail:{client:window.__testNavClient,userId:window.__communityTest.user.id,moderator:true}})));
  assert.equal(await p.locator('#nav-profile span').textContent(),'gabrielish');assert.equal(await p.locator('#nav-notifications .nav-account-count').textContent(),'1','Token refresh must not reset counters to zero');
  if(width<1100){assert.equal(await p.locator('.main-navigation').isVisible(),false);await p.locator('.nav-toggle').click();assert(await p.locator('#nav-profile').isVisible());}
  await p.waitForTimeout(1100);await p.evaluate(()=>window.__watchNav=false);
  const frames=await p.evaluate(()=>window.__frames);assert(frames.length>0);assert(frames.every(f=>f.name==='gabrielish'&&f.tools&&!f.login&&f.badge==='1'&&!f.guestFields),'Navbar flashed a provisional name, login button, hidden controls or empty counter');
  await p.evaluate(()=>{localStorage.removeItem('bg3ro-auth');dispatchEvent(new CustomEvent('bg3ro:auth',{detail:{client:window.__testNavClient,userId:null,moderator:false}}));});
  assert.equal(await p.evaluate(()=>localStorage.getItem('bg3ro-nav-display')),null,'Logout clears cached presentation');
  assert.equal(await p.locator('.nav-account-tools').isVisible(),false);assert.deepEqual(errors,[]);await p.close();console.log('PASS first-paint navbar '+width+' with delayed scripts/profile, stable geometry/counts and logout isolation');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
