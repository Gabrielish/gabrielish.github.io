const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const {clickNav}=require('./nav-action.cjs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
let sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
sdk=sdk.replace('updates:[]','updates:[],releases:window.__qaReleases')
 .replace("if(this.operation==='update'){state[key]","if(this.operation==='update'){if(state.failUpdate)return{data:null,error:{message:'Network error'}};state[key]")
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
  await clickNav(page,'.topbar [data-auth-open]');await page.locator('#discord-login').click();await page.waitForSelector('#auth-dialog',{state:'hidden'});
  const releaseBefore=await page.locator('#updates-feed').textContent();
  assert.equal(await page.locator('#admin-tools .inline-update-publish > summary').count(),1,'Publication stays inline');
  assert.equal(await page.locator('#admin-tools').evaluate(el=>el.classList.contains('card')),false,'No administration card');
  assert.equal(await page.locator('#admin-tools > h2,#admin-tools > p').count(),0);
  await page.getByRole('button',{name:'Publică o actualizare',exact:true}).click();const form=page.locator('#update-form');
  assert.equal(await page.locator('#actualizari dialog').count(),0,'No publication modal');
  const compact=async locator=>{
   const rows=locator.locator(':scope > .update-field-row');assert.equal(await rows.count(),2);assert.deepEqual(await rows.nth(0).locator('input').evaluateAll(nodes=>nodes.map(n=>n.name)),['title','badge_label']);assert.deepEqual(await rows.nth(1).locator('input').evaluateAll(nodes=>nodes.map(n=>n.name)),['link_url','link_label']);assert.deepEqual(await rows.locator('label').allTextContents(),['Titlu','Etichetă','Adresă link','Nume link']);
   for(const input of await rows.locator('input:not([type=hidden]),.update-badge-trigger').all())assert.equal(Math.round((await input.boundingBox()).height),width<=600?40:38,'Compact input height');
   for(const row of await rows.all()){const [a,b]=await row.locator('input:not([type=hidden]),.update-badge-trigger').all(),x=await a.boundingBox(),y=await b.boundingBox();if(width>600){assert(Math.abs(x.width/y.width-3)<.03,'Desktop rows use 75/25 widths');assert(Math.abs(x.y-y.y)<1);}else{assert(y.y>x.y+x.height);assert(Math.abs(x.width-y.width)<1);}}
   const top=await rows.nth(0).boundingBox(),editor=await locator.locator('.discussion-editor-shell').boundingBox(),bottom=await rows.nth(1).boundingBox();assert(top.y+top.height<=editor.y);assert(bottom.y>=editor.y+editor.height);
   for(const button of await locator.locator(':scope > .form-end > .btn').all())assert.equal(Math.round((await button.boundingBox()).height),36,'Discussion-sized action buttons');
  };await compact(form);assert.equal(await form.locator('[type=submit]').textContent(),'Publică');assert.equal(await form.locator('[name=badge_label]').getAttribute('required'),null);assert.equal(await form.locator('[name=link_url]').getAttribute('required'),null);
  await form.locator('[name=title]').fill('Anunț manual');
  const body=form.locator('.discussion-prosemirror');
  await body.fill('Scurt');await form.locator('[type=submit]').click();await form.locator('.form-status.error').waitFor();assert.equal(await page.evaluate(()=>window.__communityTest.updates.length),0);
  await body.fill('x'.repeat(12001));await form.locator('[type=submit]').click();await form.locator('.form-status.error').waitFor();assert.equal(await page.evaluate(()=>window.__communityTest.updates.length),0,'Update limit remains 12000 characters');
  await body.fill('Am terminat revizia.');await body.press('ControlOrMeta+a');await form.getByRole('button',{name:'Aldin',exact:true}).click();
  await body.press('ArrowRight');await body.press('Enter');await form.getByRole('button',{name:'Aldin',exact:true}).click();
  await form.getByRole('button',{name:'Listă cu puncte',exact:true}).click();await body.pressSequentially('Termeni consecvenți');await body.press('Enter');await body.pressSequentially('Acorduri corecte');await body.press('Enter');await body.press('Enter');
  await body.pressSequentially('Raportează o eroare');await body.press('Shift+Home');
  await form.getByRole('button',{name:'Adaugă sau modifică linkul',exact:true}).click();await form.locator('.discussion-link-panel input').fill('#erori');await form.getByRole('button',{name:'Aplică linkul',exact:true}).click();
  async function setBadge(target,text,color='#f97316',glyph='clock'){await target.locator('.update-badge-trigger').click();const menu=page.locator('.update-badge-menu:popover-open');await menu.getByLabel('Textul etichetei',{exact:true}).fill(text);await menu.getByLabel('Codul culorii etichetei',{exact:true}).fill(color);await menu.locator('[data-icon="'+glyph+'"]').click();await menu.getByRole('button',{name:'Aplică',exact:true}).click();}
  await form.locator('[name=link_label]').fill('Pagina proiectului');await form.locator('[name=link_url]').fill('javascript:alert(1)');await setBadge(form,'În lucru');
  await form.screenshot({path:`.qa/inline-update-publish-${width}.png`});
  await form.locator('[type=submit]').click();await page.waitForSelector('#update-form .form-status.error');assert.equal(await page.evaluate(()=>window.__communityTest.updates.length),0);
  await form.locator('[name=link_url]').fill('https://example.com/project');await form.locator('[type=submit]').click();
  await page.waitForSelector('#updates-feed .manual-update',{state:'attached'});await page.keyboard.press('Escape');
  const manual=page.locator('#updates-feed .manual-update');
  assert.equal(await manual.locator('.card').count(),0,'No nested cards inside a news card');
  assert(await manual.evaluate(el=>el.classList.contains('card')),'Each news entry is one card');
  assert.equal(await manual.locator('.release-news-link').textContent(),'Pagina proiectului');
  assert.equal(await manual.locator('.release-news-link').getAttribute('href'),'https://example.com/project');
  assert.equal(await manual.locator('.release-version-badge').textContent(),'În lucru');
  assert.equal(await manual.locator('.update-header-badge').evaluate(el=>el.style.getPropertyValue('--badge-color')),'#f97316');assert.equal(await manual.locator('.update-header-badge svg').count(),1);assert.equal(await page.evaluate(()=>window.__communityTest.updates[0].badge_icon),'clock');assert.equal(await form.locator('[name=badge_label]').inputValue(),'','Publishing resets the header badge');
  assert.equal(await manual.locator('.rich-content ul li').count(),2);
  const reportLink=manual.locator('.rich-content a');
  assert.equal(await reportLink.textContent(),'Raportează o eroare');assert.equal(await reportLink.getAttribute('href'),'#erori');
  await reportLink.click();assert(await page.locator('#erori').isVisible());await page.locator('#tab-actualizari').click();
  const safety=await page.evaluate(()=>{const n=window.BG3RO_CONTENT.render('<img src=x onerror=alert(1)>\n\n[Periculos](javascript:alert(1))\n\n[Sigur](https://example.com)');return {images:n.querySelectorAll('img').length,links:[...n.querySelectorAll('a')].map(a=>a.href)};});
  assert.deepEqual(safety,{images:0,links:['https://example.com/']});
  assert.equal(await page.locator('#updates-feed .release-news .manual-update-toolbar').count(),1);
  const actions=manual.locator('.manual-update-toolbar');assert.equal(await actions.locator('svg').count(),3);assert.equal(await actions.locator('button').first().textContent(),'Editează');
  await page.evaluate(()=>window.__communityTest.failUpdate=true);await manual.getByRole('button',{name:'Ascunde actualizarea',exact:true}).click();await manual.locator('.form-status.error').waitFor();assert.equal(await manual.locator(':scope.is-content-hidden').count(),0);await page.evaluate(()=>window.__communityTest.failUpdate=false);await manual.getByRole('button',{name:'Ascunde actualizarea',exact:true}).click();await manual.locator(':scope.is-content-hidden').waitFor();assert.equal(await page.evaluate(()=>window.__communityTest.updates[0].is_visible),false);await manual.getByRole('button',{name:'Afișează actualizarea',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.manual-update.is-content-hidden'));
  await manual.getByRole('button',{name:'Editează actualizarea',exact:true}).click();let modal=manual.locator('.update-inline-editor');
  assert.equal(await manual.locator('dialog').count(),0,'Editing is inline');
  await compact(modal);await modal.screenshot({path:`.qa/compact-update-edit-${width}.png`});
  assert.equal(await modal.getByRole('button',{name:'Listă cu puncte',exact:true}).count(),1);
  assert.equal(await modal.locator('.discussion-prosemirror ul li').count(),2);
  assert.equal(await modal.locator('.discussion-prosemirror a').getAttribute('href'),'#erori');
  await modal.locator('.update-badge-trigger').click();let badgeMenu=page.locator('.update-badge-menu:popover-open');assert.equal(await badgeMenu.getByLabel('Textul etichetei',{exact:true}).inputValue(),'În lucru');assert.equal(await badgeMenu.getByLabel('Codul culorii etichetei',{exact:true}).inputValue(),'#f97316');await badgeMenu.getByLabel('Textul etichetei',{exact:true}).fill('Ciornă etichetă');await badgeMenu.getByRole('button',{name:'Anulează',exact:true}).click();assert.equal(await modal.locator('[name=badge_label]').inputValue(),'În lucru');
  await modal.locator('.update-badge-trigger').click();await badgeMenu.getByRole('button',{name:'Elimină',exact:true}).click();assert.equal(await modal.locator('[name=badge_label]').inputValue(),'');
  await modal.locator('.discussion-prosemirror').fill('Ciornă care trebuie eliminată.');await modal.getByRole('button',{name:'Anulează',exact:true}).click();
  await manual.getByRole('button',{name:'Editează actualizarea',exact:true}).click();modal=manual.locator('.update-inline-editor');assert.equal(await modal.locator('.discussion-prosemirror ul li').count(),2,'Cancel restores the saved rich content');
  await modal.locator('[name=title]').fill('Titlu editat');await modal.locator('[name=link_label]').fill('Alt link');await modal.locator('[name=link_url]').fill('https://example.com/edited');await setBadge(modal,'Actualizat','#3b82f6','star');
  await modal.locator('.update-badge-trigger').click();badgeMenu=page.locator('.update-badge-menu:popover-open');const box=await badgeMenu.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=1000);await badgeMenu.screenshot({path:'.qa/update-badge-menu-'+width+'.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('.update-badge-menu:popover-open').count(),0);
  await modal.locator('.update-badge-trigger').click();badgeMenu=page.locator('.update-badge-menu:popover-open');await badgeMenu.getByLabel('Alege iconiță SVG pentru eticheta actualizării',{exact:true}).setInputFiles({name:'test.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>window.headerBadgeXSS=true</script><image href="https://evil.example/icon.png"/><circle cx="12" cy="12" r="8" onclick="window.headerBadgeXSS=true"/></svg>')});await badgeMenu.locator('.badge-preview circle').waitFor();assert.equal(await badgeMenu.locator('script,image,[onclick]').count(),0);await badgeMenu.getByRole('button',{name:'Aplică',exact:true}).click();
  await page.evaluate(()=>window.__communityTest.failUpdate=true);await modal.getByRole('button',{name:'Salvează modificările'}).click();await modal.locator('.form-status').filter({hasText:'nu au fost salvate'}).waitFor();assert.equal(await modal.locator('.discussion-prosemirror ul li').count(),2,'Failure retains the rich draft');
  await page.evaluate(()=>window.__communityTest.failUpdate=false);await modal.screenshot({path:`.qa/inline-update-edit-${width}.png`});await modal.getByRole('button',{name:'Salvează modificările'}).click();
  await page.waitForFunction(()=>document.querySelector('#updates-feed .manual-update .post-title')?.textContent==='Titlu editat');
  assert.equal(await manual.locator('.release-version-badge').textContent(),'Actualizat');
  assert.equal(await manual.locator('.update-header-badge circle').count(),1);assert.equal(await page.evaluate(()=>window.headerBadgeXSS),undefined);assert.equal(await manual.locator('.update-header-badge').evaluate(el=>el.style.getPropertyValue('--badge-color')),'#3b82f6');
  assert.equal(await manual.locator('.release-news-link').getAttribute('href'),'https://example.com/edited');
  await manual.screenshot({path:`.qa/manual-update-${width}.png`});
  await manual.getByRole('button',{name:'Ascunde actualizarea',exact:true}).click();await manual.locator(':scope.is-content-hidden').waitFor();await clickNav(page,'#sign-out');await page.waitForFunction(()=>!document.querySelector('.manual-update'));await clickNav(page,'.topbar [data-auth-open]');await page.locator('#discord-login').click();await manual.getByRole('button',{name:'Afișează actualizarea',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.manual-update.is-content-hidden'));
  page.once('dialog',d=>d.dismiss());await manual.getByRole('button',{name:'Șterge actualizarea',exact:true}).click();assert.equal(await page.evaluate(()=>window.__communityTest.updates.length),1);
  page.once('dialog',d=>d.accept());await manual.getByRole('button',{name:'Șterge actualizarea',exact:true}).click();await page.waitForFunction(()=>window.__communityTest.updates.length===0);
  assert.equal(await page.locator('#updates-feed').textContent(),releaseBefore,'Automatic release news is unchanged');
  assert.equal(await page.evaluate(()=>window.__communityTest.releases.length),1);
  await clickNav(page,'#sign-out');await page.waitForSelector('#sign-out',{state:'hidden'});
  assert.equal(await page.locator('.manual-update-toolbar').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: inline rich publication/editing, custom link and badge, internal links, unsafe URL rejection, cancel, deletion, logout and unchanged releases at 320/390/1440px.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
