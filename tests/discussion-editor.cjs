const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'};"}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await page.goto('http://127.0.0.1:4173/#discutii',{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
  const editor=page.locator('#discussion-editor .discussion-prosemirror'),replyEditor=page.locator('#reply-discussion-editor .discussion-prosemirror');
  assert(await editor.isVisible());assert.equal(await editor.getAttribute('contenteditable'),'true');
  const defaults=await editor.evaluate(el=>{const style=getComputedStyle(el);return [style.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g,''),style.fontSize];});
  assert.equal(await page.locator('#discussion-form select[aria-label="Font"] option:checked').textContent(),defaults[0]);
  assert.equal(await page.locator('#discussion-form select[aria-label="Mărimea textului"] option:checked').textContent(),defaults[1]);
  assert.equal(await page.locator('#discussion-title').isVisible(),false);
  assert.equal(await page.locator('#discussion-body').isVisible(),false);
  await page.locator('#discussion-name').fill('Vizitator de test');
  await editor.fill('Felicitări pentru traducere!');await editor.press('ControlOrMeta+a');
  await page.getByRole('button',{name:'Aldin',exact:true}).click();assert.equal(await editor.locator('strong').textContent(),'Felicitări pentru traducere!');
  await page.getByRole('button',{name:'Adaugă sau modifică linkul'}).click();
  await page.locator('#discussion-link-url').fill('https://example.com/feedback');await page.locator('#discussion-link-save').click();
  assert.equal(await editor.locator('a').getAttribute('href'),'https://example.com/feedback');
  await page.locator('#discussion-form button[type=submit]').click();await page.waitForSelector('#discussion-list .post');
  assert.equal(await page.locator('#discussion-list .post-title').count(),0);
  assert.equal(await page.locator('#discussion-list .post-body strong').textContent(),'Felicitări pentru traducere!');
  assert.equal(await page.locator('#discussion-list .post-body a').getAttribute('rel'),'noopener noreferrer nofollow ugc');
  assert(await page.evaluate(()=>window.__communityTest.comments[0].body.startsWith('BG3RO-RICH-1:')));
  assert.equal((await editor.innerText()).trim(),'');
  await page.locator('#discussion-list').getByRole('button',{name:'Citat',exact:true}).click();
  assert.equal(await replyEditor.locator('blockquote').count(),1);assert(await page.locator('#reply-reply-label').isVisible());
  assert(await editor.isVisible(),'Top editor remains visible while quoting');
  await page.locator('#reply-discussion-form button[type=submit]').click();await page.waitForFunction(()=>window.__communityTest.comments.length===2);
  assert.equal(await page.locator('#discussion-list > .post-thread').count(),1,'Reply does not create another root');
  assert.equal(await page.locator('#discussion-list .reply blockquote').count(),1);
  assert.equal(await page.locator('#tab-discutii').textContent(),'Discuții (1)');
  await page.evaluate(()=>{
   const json={type:'doc',content:[{type:'paragraph',attrs:{textAlign:'url(javascript:alert(1))'},content:[{type:'text',text:'Unsafe link',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]},{type:'image',attrs:{src:'https://tracker.test/evil.png',onerror:'alert(1)'}},{type:'script',content:[{type:'text',text:'alert(1)'}]}]};
   document.querySelector('#discussion-list').append(window.BG3RO_DISCUSSION_EDITOR.render('BG3RO-RICH-1:'+JSON.stringify(json)));
  });
  assert.equal(await page.locator('#discussion-list .post-body img,#discussion-list script,#discussion-list a[href^="javascript:"]').count(),0);
  await editor.fill('Mic');await page.locator('#discussion-form button[type=submit]').click();
  assert((await page.locator('#discussion-form .form-status').textContent()).includes('10 caractere'));
  await editor.fill('x'.repeat(4001));assert((await page.locator('#discussion-editor-error').textContent()).includes('depășește'));
  await editor.fill('Un comentariu care poate fi publicat.');
  if(width===1440){
   const formats=[['Cursiv','italic'],['Subliniat','underline'],['Tăiat','strike'],['Titlu H2','heading',{level:2}],['Titlu H3','heading',{level:3}],['Listă cu puncte','bulletList'],['Listă numerotată','orderedList'],['Citat','blockquote'],['Cod','codeBlock']];
   for(const [label,type,attrs]of formats){
    await page.evaluate(()=>{const e=window.BG3RO_DISCUSSION_EDITOR.editor;e.commands.setContent({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Formatare de verificat.'}]}]});e.commands.selectAll();});
    await page.locator('#discussion-form').getByRole('button',{name:label,exact:true}).click();
    const tag={heading:attrs?.level===3?'h3':'h2',bulletList:'ul',orderedList:'ol',blockquote:'blockquote',codeBlock:'pre'}[type];
    if(tag)assert.equal(await editor.locator(tag).count(),1,label);
    else assert(await page.evaluate(([type,attrs])=>window.BG3RO_DISCUSSION_EDITOR.editor.isActive(type,attrs),[type,attrs]),label);
   }
   await page.evaluate(()=>window.BG3RO_DISCUSSION_EDITOR.editor.commands.setContent({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Aliniere de verificat.'}]}]}));
   await page.getByRole('button',{name:'Aliniere centrată',exact:true}).click();
   assert.equal(await editor.locator('p').evaluate(el=>getComputedStyle(el).textAlign),'center');
   await page.getByRole('button',{name:'Anulează ultima modificare',exact:true}).click();
   assert.notEqual(await editor.locator('p').evaluate(el=>getComputedStyle(el).textAlign),'center');
   await page.getByRole('button',{name:'Refă modificarea',exact:true}).click();
   assert.equal(await editor.locator('p').evaluate(el=>getComputedStyle(el).textAlign),'center');
   await page.evaluate(()=>window.BG3RO_DISCUSSION_EDITOR.editor.commands.selectAll());
   await page.locator('#discussion-form').getByLabel('Font',{exact:true}).selectOption('Georgia');
   await page.locator('#discussion-form').getByLabel('Mărimea textului',{exact:true}).selectOption('20px');
   await page.locator('#discussion-form').getByLabel('Culoarea textului',{exact:true}).fill('#86c397');
   await page.locator('#discussion-form').getByRole('button',{name:'Aliniere justificată',exact:true}).click();
   assert.equal(await editor.locator('p').evaluate(el=>getComputedStyle(el).textAlign),'justify');
   const rich=await page.evaluate(()=>{const body=window.BG3RO_DISCUSSION_EDITOR.value();document.querySelector('#discussion-list').append(window.BG3RO_DISCUSSION_EDITOR.render(body));return body;});
   assert(rich.includes('Georgia')&&rich.includes('20px')&&rich.includes('#86c397'),'Font, size and color survive serialization');
   const styled=page.locator('#discussion-list>.discussion-rich span').last();
   assert.equal(await styled.evaluate(el=>getComputedStyle(el).fontSize),'20px');
   await page.locator('#discussion-form').getByRole('button',{name:'Elimină formatarea',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.BG3RO_DISCUSSION_EDITOR.editor.isActive('textStyle')),false);
  }
  await page.locator('#discussion-list > .discussion-rich').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
  await page.addStyleTag({content:'.topbar{visibility:hidden!important}'});
  await page.locator('.discussion-compose').screenshot({path:`.qa/visual-editor-${width}.png`});
  await page.locator('.discussion-feed-card').screenshot({path:`.qa/visual-feed-${width}.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: independent Tiptap editors, font/size/color/justify and saved formatting, no titles, quote/reply workflow, legacy text, minimum/maximum limits, XSS allowlist and mobile layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
