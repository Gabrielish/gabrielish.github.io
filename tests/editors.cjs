const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>')).replace("if(this.operation==='update')Object.assign(state.status,this.payload);","if(this.operation==='update'){if(state.failAbout)return{data:null,error:{message:'Network error'}};Object.assign(state.status,this.payload);}");
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test'};"}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await page.addInitScript(()=>window.__qaOwner=true);
  await page.goto('http://127.0.0.1:4173/#despre',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#faq-scurt').count(),0);
  assert.equal(await page.locator('#intrebari-frecvente').count(),1);
  assert.equal(await page.locator('#despre .edit-pencil:visible').count(),0);
  await page.evaluate(async()=>{await window.__communityTest;document.querySelector('#auth-dialog').showModal()});
  await page.locator('#auth-consent').check();await page.locator('#discord-login').click();
  await page.waitForSelector('#auth-dialog',{state:'hidden'});
  await page.waitForSelector('#about-editor > button',{state:'visible'});
  assert.equal(await page.locator('#despre .edit-pencil:visible').count(),2);
  for(const selector of ['.progress-card','#current-work']){
   const positions=await page.locator(selector).evaluate(card=>{
    const row=card.querySelector('.editable-header'),title=row.querySelector(':scope > h2'),button=row.querySelector(':scope > .edit-control > button');
    const a=title.getBoundingClientRect(),b=button.getBoundingClientRect(),r=row.getBoundingClientRect();return {titleRight:a.right,x:b.x,y:b.y,top:r.y,right:b.right,rowRight:r.right};
   });
   assert(positions.rowRight>0);assert(positions.x>=positions.titleRight);assert(Math.abs(positions.right-positions.rowRight)<1);assert(Math.abs(positions.y-positions.top)<1);
  }
  await page.locator('#tab-actualizari').click();
  await page.locator('#admin-tools').screenshot({path:`.qa/editor-admin-position-${width}.png`});
  await page.locator('#tab-despre').click();
  await page.locator('#progress-editor > button').click();
  assert.equal(await page.locator('#progress-form input').count(),3,'Only progress percentages remain');
  assert.equal(await page.locator('#progress-review,#progress-testing').count(),0);
  await page.locator('#progress-value').fill('84');await page.locator('#progress-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#translation-percent').textContent==='84%');
  await page.keyboard.press('Escape');assert(await page.locator('#progress-editor > button').evaluate(el=>el===document.activeElement));
  await page.locator('#about-editor > button').click();
  const editor=page.locator('#about-form');assert(await editor.isVisible());assert.equal(await page.locator('#about-editor dialog').count(),0);
  assert.equal(await editor.locator('.discussion-toolbar').count(),1);assert.equal(Math.round((await editor.locator('#about_title').boundingBox()).height),width<=600?40:38);assert.equal(Math.round((await editor.locator('[type=submit]').boundingBox()).height),36);
  const initial=await editor.locator('.discussion-prosemirror').textContent();await editor.locator('.discussion-prosemirror').fill('Ciornă nesalvată.');await editor.getByRole('button',{name:'Anulează',exact:true}).click();assert.equal(await editor.isVisible(),false);await page.locator('#about-editor > button').click();assert.equal(await editor.locator('.discussion-prosemirror').textContent(),initial);
  await page.locator('#about_title').fill('Despre traducere');await editor.locator('.discussion-prosemirror').fill('<img src=x onerror=alert(1)>\n\nText de test.');await page.locator('#about_note').fill('');
  await editor.locator('.discussion-prosemirror').press('ControlOrMeta+a');await editor.getByRole('button',{name:'Aldin',exact:true}).click();await editor.getByRole('button',{name:'Culoarea textului',exact:true}).click();await editor.getByRole('menuitemradio',{name:'Verde',exact:true}).click();
  await page.evaluate(()=>window.__communityTest.failAbout=true);await page.locator('#about-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#about-form .form-status').textContent.includes('nu au fost salvate'));
  assert.equal(await page.locator('.about-copy > h2').textContent(),'Despre proiect');
  await page.evaluate(()=>window.__communityTest.failAbout=false);await page.locator('#about-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('.about-copy h2').textContent==='Despre traducere');
  assert.equal(await page.locator('#about-project-body img').count(),0);assert.equal(await page.locator('.about-copy > .note').isVisible(),false);
  assert.equal(await editor.isVisible(),false);assert(await page.locator('#about-project-body strong').count());assert(await page.locator('#about-project-body span[style*="color"]').count());assert(await page.evaluate(()=>window.__communityTest.status.about_body.startsWith('BG3RO-RICH-1:')));
  assert(await page.locator('#about-editor > button').evaluate(el=>el===document.activeElement));
  await page.locator('#about-editor > button').click();assert(await editor.locator('.discussion-prosemirror strong').count());await editor.screenshot({path:`.qa/editor-about-${width}.png`});await editor.getByRole('button',{name:'Anulează',exact:true}).click();
  await page.locator('#about-editor > button').click();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('bg3ro:auth',{detail:{client:null,moderator:false}})));
  assert.equal(await editor.isVisible(),false,'Logout closes privileged editor');
  assert.equal(await page.locator('#despre .edit-pencil:visible').count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: admin-only progress dialogs and inline rich About editor, formatting round-trip, cancel, save failures, safe text, compact controls, focus restoration and logout at 320/390/1440px.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
