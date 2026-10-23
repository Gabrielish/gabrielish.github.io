const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8'),sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,1440]){
 const p=await browser.newPage({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600,reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://baldursgate3.game/**',r=>r.abort());await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'};"}));await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
 await p.goto('http://127.0.0.1:4173/#discutii',{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');
 for(const kind of ['discussion','reply','report','report-reply','report-edit']){
  await p.evaluate(kind=>{
   if(kind==='reply'){const form=document.querySelector('#reply-discussion-form');document.querySelector('#discussion-composer-home').append(form);form.hidden=false;}
   if(kind==='report-reply')window.__fontReply=window.BG3RO_CREATE_REPORT_REPLY(document.querySelector('#reports-list'));
   if(kind==='report-edit')window.__fontEdit=window.BG3RO_CREATE_REPORT_REPLY(document.querySelector('#reports-list'),'',true);
  },kind);
  if(kind==='report')await p.locator('#tab-erori').click();
  const form=p.locator({discussion:'#discussion-form',reply:'#reply-discussion-form',report:'#report-form','report-reply':'.report-inline-reply','report-edit':'.report-inline-edit'}[kind]),editor=form.locator('.discussion-prosemirror');
  assert.equal(await form.locator('select.discussion-tool-select').count(),0,'No native Windows selects');
  await editor.fill('Text sintetic pentru verificarea fontului.');await editor.press('ControlOrMeta+a');
  await form.getByRole('button',{name:'Culoarea textului',exact:true}).click();
  const shell=await p.locator('.discussion-color-menu:popover-open').evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderRadius,s.borderColor,s.boxShadow,s.padding,s.width];});
  await p.keyboard.press('Escape');
  for(const [label,value,attribute]of [['Font','Georgia','fontFamily'],['Mărimea textului','20px','fontSize']]){
   const trigger=form.getByRole('button',{name:label,exact:true}),menu=p.getByRole('menu',{name:label,exact:true});
   await trigger.click();assert.equal(await trigger.getAttribute('aria-expanded'),'true');
   assert.deepEqual(await menu.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderRadius,s.borderColor,s.boxShadow,s.padding,s.width];}),shell,'Font menu matches the text color menu');
   if(width<600)await trigger.tap();else await trigger.click();assert.equal(await menu.isVisible(),false,'Second click closes the menu');
   await trigger.click();const box=await menu.boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=900);
   if(kind==='discussion')await menu.screenshot({path:`.qa/editor-${attribute}-${width}.png`});
   await menu.getByRole('menuitemradio',{name:value,exact:true}).click();
   assert.equal(await menu.isVisible(),false);assert.equal(await trigger.locator('span').first().textContent(),value,`${kind} ${width} ${label}: ${await editor.innerHTML()}`);
   assert.equal(await editor.locator('span').first().evaluate((el,key)=>el.style[key],attribute),value,'Formatting applies to the original selection');
   await trigger.focus();await p.keyboard.press('ArrowDown');assert.equal(await menu.getByRole('menuitemradio',{name:value,exact:true}).getAttribute('aria-checked'),'true');
   await p.keyboard.press('Escape');assert(await trigger.evaluate(el=>el===document.activeElement));
   await trigger.click();await p.keyboard.press('Home');await p.keyboard.press('Enter');
   assert.equal(await editor.locator('span').evaluateAll((els,key)=>els.some(el=>el.style[key]),attribute),false,'Default removes the style');
   await trigger.click();await editor.click();assert.equal(await menu.isVisible(),false,'Outside click dismisses');
   await editor.press('ControlOrMeta+a');
  }
 }
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.close();
}console.log('PASS: custom font/size menus match color styling in all five editors; selection, reset, keyboard, second click/tap and viewport bounds at 320/390/1440px.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
