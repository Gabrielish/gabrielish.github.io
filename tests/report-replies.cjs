const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const {clickNav}=require('./nav-action.cjs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>')).replace('reports:[]',`reports:[{id:'qa-report',title:'O eroare de traducere',body:'Un mesaj de test care descrie problema întâlnită în joc.',status:'new',platform:'windows',mod_version:'test',is_public:true,author_id:'someone',author_name:'Gabriel',created_at:'2026-10-19T10:00:00Z',moderator_reply:'Răspunsul administratorului păstrat din versiunea anterioară.',reply_author_name:'gabrielish',reply_created_at:'2026-10-20T10:00:00Z'}]`);
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440])for(const persona of ['guest','member','admin']){
  const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://baldursgate3.game/**',r=>r.abort());
  await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test-public'};"}));
  await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await p.addInitScript(isAdmin=>{window.__qaOwner=isAdmin;window.__qaReportReplies=[{id:'old-reply',report_id:'qa-report',author_id:'another',author_name:'Alt jucător',body:'Un răspuns obișnuit de la alt utilizator.',created_at:'2026-10-21T10:00:00Z',author_is_admin:false,is_guest:false}];},persona==='admin');
  await p.goto('http://127.0.0.1:4173/#erori',{waitUntil:'networkidle'});
  if(persona!=='guest'){await clickNav(p,'.topbar [data-auth-open]');await p.locator('#discord-login').click();await p.waitForSelector('#auth-dialog',{state:'hidden'});}
  await p.locator('[data-reply-id=old-reply]').waitFor();
  assert.equal(await p.locator('.report-state-trigger').count(),persona==='admin'?1:0);
  assert.equal(await p.locator('.report-admin-answer').count(),1,'Legacy administrator reply kept in the gold card');
  if(persona==='admin'){
   await p.getByRole('button',{name:'Editează răspunsul',exact:true}).click();
   const legacy=p.locator('.report-inline-reply');assert((await legacy.locator('.discussion-prosemirror').innerText()).includes('versiunea anterioară'));
   await legacy.getByRole('button',{name:'Anulează',exact:true}).click();
  }
  assert.equal(await p.locator('[data-reply-id=old-reply].report-admin-answer').count(),0,'Ordinary reply stays plain');
  assert.equal(await p.locator('[data-reply-id=old-reply] .report-reply-actions').count(),persona==='admin'?1:0);
  const trigger=p.locator('.report-community-actions').getByRole('button',{name:'Răspunde',exact:true});await trigger.click();
  const form=p.locator('.report-comment-editor'),editor=form.locator('.discussion-prosemirror');await editor.waitFor();
  assert.equal(await form.locator('.report-guest-name input').count(),persona==='guest'?1:0);
  if(persona==='guest')await form.locator('.report-guest-name input').fill('Oaspete QA');
  await editor.fill('Răspuns nou, scris direct sub raportarea erorii.');
  await p.evaluate(()=>window.__communityTest.failInsert=true);await form.getByRole('button',{name:'Răspunde',exact:true}).click();await form.locator('.form-status.error').waitFor();
  assert((await editor.innerText()).includes('Răspuns nou'),'Failure preserves draft');
  await p.evaluate(()=>window.__communityTest.failInsert=false);await form.getByRole('button',{name:'Răspunde',exact:true}).click();await form.waitFor({state:'detached'});
  await p.waitForFunction(()=>document.querySelectorAll('[data-reply-id]').length===2);
  const id=await p.evaluate(()=>window.__communityTest.reportReplies.find(r=>r.id!=='old-reply').id),reply=p.locator(`[data-reply-id="${id}"]`);
  assert.equal(await reply.locator('time').count(),1);assert.equal(await reply.locator('img.post-avatar').count(),1);
  assert.equal(await reply.evaluate(el=>el.classList.contains('report-admin-answer')),persona==='admin');
  assert.equal(await reply.locator('.report-reply-actions button').count(),2);
  assert.equal(await p.evaluate(()=>window.__communityTest.reports[0].status),'new','Reply cannot change report status');
  if(persona==='admin'){assert.notEqual(await reply.evaluate(el=>getComputedStyle(el).backgroundImage),'none');assert.equal(await reply.evaluate(el=>getComputedStyle(el).borderRadius),'14px');}
  await reply.getByRole('button',{name:'Editează',exact:true}).click();await editor.fill('Răspuns editat de autor, cu textul păstrat.');await form.getByRole('button',{name:'Salvează',exact:true}).click();await form.waitFor({state:'detached'});
  await p.waitForFunction(id=>document.querySelector(`[data-reply-id="${id}"]`).textContent.includes('Răspuns editat'),id);
  await p.locator('.report-item').screenshot({path:`.qa/report-replies-${persona}-${width}.png`});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile overflow');
  p.once('dialog',d=>d.dismiss());await reply.getByRole('button',{name:'Șterge',exact:true}).click();assert.equal(await reply.count(),1);
  p.once('dialog',d=>d.accept());await reply.getByRole('button',{name:'Șterge',exact:true}).click();await reply.waitFor({state:'detached'});
  assert.equal(await p.locator('[data-reply-id=old-reply]').count(),1);assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS: guest/member/admin replies, gold administrator cards only in reports, legacy replies, retry/edit/delete and mobile layout at 320/390/1440px.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
