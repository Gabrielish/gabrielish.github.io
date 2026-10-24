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
  await p.goto('http://127.0.0.1:4173/#despre',{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');
  assert.equal(await p.locator('#actualizari > .card-header').count(),0);assert.equal(await p.locator('#actualizari a[href*="tab=logs"]').count(),0);
  assert.equal(await p.locator('#current-work .about-section-tools').count(),0);
  assert.equal(await p.locator('#despre .about-copy + #current-work').count(),1);
  assert.equal(await p.locator('#actualizari #current-work').count(),0);
  await clickNav(p,'.topbar [data-auth-open]');await p.locator('#auth-consent').check();await p.locator('#discord-login').click();await p.waitForSelector('#auth-dialog',{state:'hidden'});
  assert.equal(await p.locator('#current-work .about-section-tools').isVisible(),owner);
  if(owner){
   await p.getByRole('button',{name:'Editează La ce lucrez acum',exact:true}).click();const form=p.locator('#current-work form');assert.equal(await form.locator('[name=title]').inputValue(),'La ce lucrez acum');
   assert.deepEqual(await form.locator('[name]').evaluateAll(nodes=>nodes.map(n=>n.name)),['title','body']);
   assert.equal(await form.locator('.help,#work-note').count(),0);
   assert.equal(await p.locator('#current-work-note').count(),0);
   await form.locator('[name=title]').fill('Etapa curentă');await form.locator('.discussion-prosemirror').fill('<img src=x onerror=alert(1)>\nRevizuiesc traducerea.');
   await p.evaluate(()=>window.__communityTest.failAbout=true);await form.locator('[type=submit]').click();await form.locator('.form-status.error').waitFor();
   assert.equal(await p.locator('#current-work-title').textContent(),'La ce lucrez acum');assert.equal(await form.locator('[name=title]').inputValue(),'Etapa curentă');
   await p.evaluate(()=>window.__communityTest.failAbout=false);await form.locator('[type=submit]').click();await p.waitForFunction(()=>document.querySelector('#current-work-title').textContent==='Etapa curentă');
   assert.equal(await p.locator('#current-work .about-section-content img').count(),0);
   assert.equal(await p.locator('#current-work-note').count(),0,'Saving must not restore the removed note');
   await clickNav(p,'#sign-out');await p.waitForFunction(()=>!document.querySelector('#current-work .about-section-tools'));assert.equal(await p.locator('#current-work-title').textContent(),'Etapa curentă');
  }
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS: moderator inline work editor contains title and rich text only; save/error/logout, existing content preservation and safe text. Synthetic SDK.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
