const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8'),sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,1440]){
 const p=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://baldursgate3.game/**',r=>r.abort());await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'};"}));await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
 await p.goto('http://127.0.0.1:4173/#discutii',{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');
 for(const kind of ['discussion','reply','report','report-reply']){
  await p.evaluate(kind=>{
   if(kind==='reply'){const home=document.querySelector('#discussion-composer-home'),form=document.querySelector('#reply-discussion-form');home.append(form);form.hidden=false;}
   if(kind==='report-reply')window.__colorTestReply=window.BG3RO_CREATE_REPORT_REPLY(document.querySelector('#reports-list'));
  },kind);
  if(kind==='report')await p.locator('#tab-erori').click();
  const selector={discussion:'#discussion-form',reply:'#reply-discussion-form',report:'#report-form','report-reply':'.report-inline-reply'}[kind],form=p.locator(selector),editor=form.locator('.discussion-prosemirror'),button=form.getByRole('button',{name:'Culoarea textului',exact:true});
  await editor.fill('Text de verificat pentru paleta de culori.');await editor.press('ControlOrMeta+a');await button.click();
  const menu=p.locator('.discussion-color-menu:popover-open');assert.equal(await menu.getByRole('menuitemradio').count(),9);assert.equal(await button.getAttribute('aria-expanded'),'true');
  const box=await menu.boundingBox();assert.equal(box.width,144,'Menu matches the reference width');assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=900,'Menu stays within the viewport');
  for(const [label,hex]of [['Roșu','ef4444'],['Portocaliu','f97316'],['Galben','eab308'],['Verde','22c55e'],['Albastru','3b82f6'],['Mov','a855f7'],['Roz','ec4899'],['Gri','6b7280']]){
   const option=menu.getByRole('menuitemradio',{name:label,exact:true});assert.equal(await option.getAttribute('data-color'),'#'+hex);assert.equal(await option.locator('.editor-color-swatch').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb('+hex.match(/../g).map(n=>parseInt(n,16)).join(', ')+')');
  }
  if(kind==='discussion')await menu.screenshot({path:`.qa/editor-colors-${width}.png`});
  await menu.getByRole('menuitemradio',{name:'Roșu',exact:true}).click();assert.equal(await editor.locator('span').evaluate(el=>el.style.color),'rgb(239, 68, 68)');assert.equal(await menu.count(),0);
  await button.click();assert.equal(await menu.getByRole('menuitemradio',{name:'Roșu',exact:true}).getAttribute('aria-checked'),'true');
  await p.keyboard.press('Escape');assert.equal(await menu.count(),0);assert(await button.evaluate(el=>el===document.activeElement));
  await button.click();await p.keyboard.press('Home');await p.keyboard.press('Enter');assert.equal(await editor.locator('span[style*=color]').count(),0,'Default removes the color mark');
  await button.click();await p.keyboard.press('ArrowDown');assert.equal(await p.locator(':focus').textContent(),'Roșu');await p.keyboard.press('Escape');
 }
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.close();
}console.log('PASS: nine-color palette in every rich editor; selection, default reset, current-color state, keyboard/Escape and viewport bounds at 320/390/1440px.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
