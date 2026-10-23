const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8'),sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,820,1440]){
 const p=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://baldursgate3.game/**',r=>r.abort());await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'};"}));await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
 await p.goto('http://127.0.0.1:4173/#erori',{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');
 assert.equal(await p.locator('#erori>.card').count(),2,'Report composer and results have separate cards');assert(await p.locator('.report-empty').isVisible());
 assert((await p.locator('.report-translation-notice').innerText()).includes('doar raportării erorilor de traducere'));
 const form=p.locator('#report-form'),editor=p.locator('#report-editor .discussion-prosemirror');
 const upload=p.locator('#report-photo-browse');
 const uploadPalette=()=>upload.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color,s.borderTopColor];});
 const uploadIdle=await uploadPalette();await upload.hover();const uploadHover=await uploadPalette();
 assert.notDeepEqual(uploadHover,uploadIdle,'Upload button has a visible theme hover');
 assert.equal(await upload.locator('svg').evaluate(el=>getComputedStyle(el).stroke),uploadHover[1],'Upload icon inherits hover foreground');
 await p.mouse.move(0,0);await upload.focus();assert.deepEqual(await uploadPalette(),uploadHover,'Keyboard focus shares the hover treatment');
 await upload.press('Tab');
 assert(await editor.isVisible());assert.equal(await p.locator('#report-title').isVisible(),false);assert.equal(await p.locator('#report-body').isVisible(),false);
 const palettes=await p.evaluate(()=>[
  ['.discussion-compose','.report-compose'],['#discussion-form .discussion-editor-shell','#report-form .discussion-editor-shell'],['#discussion-toolbar','#report-toolbar'],['#discussion-editor .discussion-prosemirror','#report-editor .discussion-prosemirror'],['#discussion-name','#report-name']
 ].map(pair=>pair.map(selector=>{const style=getComputedStyle(document.querySelector(selector));return [style.backgroundColor,style.color,style.borderTopColor];})));
 for(const [discussion,report]of palettes)assert.deepEqual(report,discussion,'Report and discussion palettes must match');
 const geometry=await p.evaluate(()=>[
  ['.discussion-editor-shell',['borderRadius','borderTopWidth']],['.discussion-toolbar',['padding','rowGap','columnGap']],['.discussion-tool-group',['padding','gap']],['.discussion-tool',['width','height']],['.discussion-tool-select',['minHeight','maxWidth','padding']],['.discussion-color',['width','height']],['.discussion-prosemirror',['minHeight','padding','lineHeight','fontSize']]
 ].map(([selector,properties])=>['#discussion-form','#report-form'].map(form=>{const s=getComputedStyle(document.querySelector(form+' '+selector));return properties.map(property=>s[property]);})));
 for(const [discussion,report]of geometry)assert.deepEqual(report,discussion,'Both tabs must share identical editor geometry');
 const actions=await p.evaluate(()=>['#discussion-form [type=submit]','#report-form .report-submit'].map(selector=>{const s=getComputedStyle(document.querySelector(selector));return [s.backgroundColor,s.color,s.borderTopColor];}));
 assert.deepEqual(actions[0],actions[1],'Report submit uses the standard theme button palette');
 assert.equal(await p.locator('.report-compose-heading svg').evaluate(el=>getComputedStyle(el).color),'rgb(215, 188, 138)','Bug icon uses theme gold');
 const editorBox=await p.locator('#report-form .discussion-editor-shell').boundingBox(),photoBox=await p.locator('#report-photo-drop').boundingBox();assert(photoBox.y>editorBox.y+editorBox.height,'Capture area is BELOW editor');
 const submitBox=await form.locator('[type=submit]').boundingBox(),formBox=await form.boundingBox();assert(Math.abs(submitBox.x+submitBox.width-formBox.x-formBox.width)<2,'Submit button aligns right '+JSON.stringify({width,submitBox,formBox}));
 await p.addStyleTag({content:'.topbar{visibility:hidden!important}'});await p.locator('#erori').screenshot({path:`.qa/report-visual-empty-${width}.png`});
 await p.locator('#report-name').fill('Vizitator');await editor.fill('Textul din descrierea acestei vrăji are un acord greșit.');await editor.press('ControlOrMeta+a');await form.getByRole('button',{name:'Aldin',exact:true}).click();
 await p.evaluate(()=>window.__communityTest.failInsert=true);await form.locator('[type=submit]').click();await p.waitForSelector('#report-form .form-status.error');assert.equal(await editor.locator('strong').count(),1,'Failed submission preserves formatting');
 await p.evaluate(()=>window.__communityTest.failInsert=false);await form.locator('[type=submit]').click();await p.waitForSelector('.report-item');
 assert.equal(await form.locator('.form-status').textContent(),'');assert(!(await form.locator('.form-status').isVisible()),'Successful reports leave no status spacing');
 assert.equal(await p.locator('.report-item .report-body strong').textContent(),'Textul din descrierea acestei vrăji are un acord greșit.');
 assert.equal(await p.evaluate(()=>window.__communityTest.reports[0].category),'text');assert.equal(await p.evaluate(()=>window.__communityTest.reports[0].title),'Textul din descrierea acestei vrăji are un acord greșit.');assert.equal((await editor.innerText()).trim(),'');
 await p.locator('#report-name').fill('Vizitator');await editor.fill('Prea scurt');await form.locator('[type=submit]').click();await p.waitForFunction(()=>document.querySelector('#report-form .form-status').textContent.includes('20 caractere'));assert.equal(await p.evaluate(()=>window.__communityTest.reports.length),1);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.close();
}console.log('PASS: report visual editor, translation notice, separate empty/feed card, screenshot row, right-aligned submit, guest posting, rich rendering, auto title, failure retention and text validation 320–1440px.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
