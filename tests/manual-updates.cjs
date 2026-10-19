const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const {clickNav}=require('./nav-action.cjs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
let sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
sdk=sdk.replace('updates:[]','updates:[],releases:window.__qaReleases')
 .replace("project_updates:'updates'","project_updates:'updates',releases:'releases'")
 .replace("key==='updates'||","key==='updates'||key==='releases'||")
 .replace("state[key].filter(matches).forEach(row=>Object.assign(row,this.payload));return{data:null,error:null}","const affected=state[key].filter(matches);affected.forEach(row=>Object.assign(row,this.payload));return{data:affected,error:null}")
 .replace("state[key]=state[key].filter(row=>!matches(row));return{data:null,error:null}","const affected=state[key].filter(matches);state[key]=state[key].filter(row=>!matches(row));return{data:affected,error:null}");
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test'};"}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await page.addInitScript(()=>{window.__qaOwner=true;window.__qaReleases=[{id:'release-1',author_name:'Gabrielish',kind:'translation',version:'0.8',tags:'Windows',title:'Automatic release',file_name:'test.zip',file_bytes:100,download_url:'https://github.com/Gabrielish/bg3ro/releases/download/test/test.zip',description:'Automatic release body',published_at:'2026-10-19T12:00:00Z'}];});
  await page.goto('http://127.0.0.1:4173/#actualizari',{waitUntil:'networkidle'});
  await clickNav(page,'.topbar [data-auth-open]');await page.locator('#auth-consent').check();await page.locator('#discord-login').click();await page.waitForSelector('#auth-dialog',{state:'hidden'});
  const releaseBefore=await page.locator('#release-updates').textContent();
  assert.equal(await page.locator('#admin-tools > .edit-control > button').count(),1,'Only one publication button remains');
  assert.equal(await page.locator('#admin-tools').evaluate(el=>el.classList.contains('card')),false,'No administration card');
  assert.equal(await page.locator('#admin-tools > h2,#admin-tools > p').count(),0);
  await page.getByRole('button',{name:'Publică o actualizare',exact:true}).click();const form=page.locator('#update-form');
  await form.locator('[name=title]').fill('Anunț manual');await form.locator('[name=body]').fill('Conținut pentru testarea actualizărilor manuale.');
  await form.locator('[name=link_label]').fill('Pagina proiectului');await form.locator('[name=link_url]').fill('javascript:alert(1)');await form.locator('[name=badge_label]').fill('În lucru');
  await form.locator('[type=submit]').click();await page.waitForSelector('#update-form .form-status.error');assert.equal(await page.evaluate(()=>window.__communityTest.updates.length),0);
  await form.locator('[name=link_url]').fill('https://example.com/project');await form.locator('[type=submit]').click();
  await page.waitForSelector('#updates-list .manual-update',{state:'attached'});await page.keyboard.press('Escape');
  const manual=page.locator('#updates-list .manual-update');
  assert.equal(await page.locator('#updates-list .card').count(),0,'No nested cards inside the updates panel');
  assert.equal(await manual.evaluate(el=>getComputedStyle(el).padding),'0px','Only outer panel supplies padding');
  assert.equal(await manual.locator('.release-news-link').textContent(),'Pagina proiectului');
  assert.equal(await manual.locator('.release-news-link').getAttribute('href'),'https://example.com/project');
  assert.equal(await manual.locator('.release-version-badge').textContent(),'În lucru');
  assert.equal(await page.locator('#release-updates .manual-update-toolbar').count(),0);
  await manual.getByRole('button',{name:'Editează actualizarea',exact:true}).click();const modal=manual.locator('dialog[open]');
  await modal.locator('[name=title]').fill('Titlu editat');await modal.locator('[name=link_label]').fill('Alt link');await modal.locator('[name=link_url]').fill('https://example.com/edited');await modal.locator('[name=badge_label]').fill('Actualizat');
  await modal.getByRole('button',{name:'Salvează modificările'}).click();
  await page.waitForFunction(()=>document.querySelector('#updates-list .post-title')?.textContent==='Titlu editat');
  assert.equal(await manual.locator('.release-version-badge').textContent(),'Actualizat');
  assert.equal(await manual.locator('.release-news-link').getAttribute('href'),'https://example.com/edited');
  await page.locator('#updates-list').locator('..').screenshot({path:`.qa/manual-update-${width}.png`});
  page.once('dialog',d=>d.dismiss());await manual.getByRole('button',{name:'Șterge actualizarea',exact:true}).click();assert.equal(await page.evaluate(()=>window.__communityTest.updates.length),1);
  page.once('dialog',d=>d.accept());await manual.getByRole('button',{name:'Șterge actualizarea',exact:true}).click();await page.waitForFunction(()=>window.__communityTest.updates.length===0);
  assert.equal(await page.locator('#release-updates').textContent(),releaseBefore,'Automatic release news is unchanged');
  assert.equal(await page.evaluate(()=>window.__communityTest.releases.length),1);
  await clickNav(page,'#sign-out');await page.waitForSelector('#sign-out',{state:'hidden'});
  assert.equal(await page.locator('.manual-update-toolbar').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: manual news publication, custom link and green label, unsafe URL rejection, modal editing, delete cancel/confirm, logout and unchanged automatic release news at 320/390/1440px.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
