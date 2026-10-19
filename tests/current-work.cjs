const {clickNav}=require('./nav-action.cjs');
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>')).replace("if(this.operation==='update')Object.assign(state.status,this.payload);","if(this.operation==='update'){if(state.failWork)return{data:null,error:{message:'Network error'}};Object.assign(state.status,this.payload);}");
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 for(const owner of [false,true]){
  const p=await b.newPage({viewport:{width:owner?1440:390,height:950},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://baldursgate3.game/**',r=>r.abort());
  await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test'};"}));
  await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await p.addInitScript(isOwner=>window.__qaOwner=isOwner,owner);
  await p.goto('http://127.0.0.1:4173/#actualizari',{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');
  assert.equal(await p.locator('#actualizari > .card-header').count(),0);assert.equal(await p.locator('#actualizari a[href*="tab=logs"]').count(),0);
  assert.equal(await p.locator('#work-editor').isVisible(),false);
  await clickNav(p,'.topbar [data-auth-open]');await p.locator('#auth-consent').check();await p.locator('#discord-login').click();await p.waitForSelector('#auth-dialog',{state:'hidden'});
  assert.equal(await p.locator('#work-editor').isVisible(),owner);
  if(owner){
   await p.locator('#work-editor > .edit-pencil').click();assert.equal(await p.locator('#work-title').inputValue(),'La ce lucrez acum');
   await p.locator('#work-title').fill('Etapa curentă');await p.locator('#work-body').fill('<img src=x onerror=alert(1)>\nRevizuiesc traducerea.');await p.locator('#work-note').fill('');
   await p.evaluate(()=>window.__communityTest.failWork=true);await p.locator('#work-form button[type=submit]').click();await p.waitForSelector('#work-form .form-status.error');
   assert.equal(await p.locator('#current-work-title').textContent(),'La ce lucrez acum');assert.equal(await p.locator('#work-title').inputValue(),'Etapa curentă');
   await p.evaluate(()=>window.__communityTest.failWork=false);await p.locator('#work-form button[type=submit]').click();await p.waitForFunction(()=>document.querySelector('#current-work-title').textContent==='Etapa curentă');
   assert.equal(await p.locator('#current-work-body img').count(),0);assert.equal(await p.locator('#current-work-note').isVisible(),false);
   await p.locator('#work-note').fill('Notă publică');await p.locator('#work-form button[type=submit]').click();await p.waitForFunction(()=>document.querySelector('#current-work-note').textContent==='Notă publică');
   assert(await p.locator('#current-work-note').isVisible());
   await p.keyboard.press('Escape');await clickNav(p,'#sign-out');await p.waitForSelector('#work-editor',{state:'hidden'});assert.equal(await p.locator('#current-work-title').textContent(),'Etapa curentă');
  }
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS: updates heading/Nexus row removed; only moderator edits work title/body/note; save/error/empty-note/logout and safe text. Synthetic SDK.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
