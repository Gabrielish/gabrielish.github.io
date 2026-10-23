const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./information-pages.cjs'),'utf8');
const {clickNav}=require('./nav-action.cjs');
const sdk=source.slice(source.indexOf('function fakeSDK(){'),source.indexOf('\n(async()=>')).replace('auth:{getSession:',"auth:{signOut:async()=>{state.user=null;callback('SIGNED_OUT',null);return{error:null};},getSession:");
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440])for(const owner of [false,true]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await page.addInitScript(value=>window.__qaContactOwner=value,owner);
  await page.goto('http://127.0.0.1:4173/#mesaje',{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
  const tab=page.locator('#tab-mesaje');
  if(!owner){
   assert.equal(await tab.isVisible(),false);assert.equal(await page.locator('#contact-inbox').isVisible(),false);assert.equal(await page.locator('.contact-message').count(),0);
   await page.locator('#tab-despre').focus();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.id),'tab-erori');
  }else{
   await page.waitForFunction(()=>document.querySelector('#tab-mesaje').textContent==='Mesaje (1)');
   assert(await page.locator('#mesaje').isVisible());assert.equal(await page.locator('#actualizari #contact-inbox').count(),0);
   assert.equal(await page.locator('[data-contact-summary]').textContent(),'1 mesaj');
   assert.equal(await page.locator('#contact-inbox h2').count(),0,'No redundant inbox heading');
   assert(!(await page.locator('#contact-inbox').textContent()).includes('Căsuță privată'));
   assert.equal(await page.locator('[data-contact-refresh]').textContent(),'','Refresh is icon-only');
   assert.equal(await page.locator('[data-contact-pagination]').isVisible(),false);
   await page.locator('.inbox-header').screenshot({path:`.qa/inbox-header-${width}.png`});
   assert.equal(await page.locator('.contact-message img').count(),0);
   const actions=page.locator('.contact-message .contact-actions');
   assert.equal(await actions.locator('svg[aria-hidden="true"]').count(),3);
   assert((await actions.getByRole('link',{name:'Răspunde prin e-mail',exact:true}).getAttribute('href')).startsWith('mailto:'));
   const styles=await actions.locator('.btn').evaluateAll(buttons=>buttons.map(button=>{const s=getComputedStyle(button);return [s.borderTopWidth,s.backgroundColor,s.fontSize,s.minHeight];}));
   for(const style of styles)assert.deepEqual(style,['0px','rgba(0, 0, 0, 0)','12px','30px']);
   const unreadIcon=await actions.getByRole('button',{name:'Marchează citit',exact:true}).locator('path').getAttribute('d');
   await page.locator('#contact-inbox').screenshot({path:`.qa/message-actions-${width}.png`});
   await page.getByRole('button',{name:'Marchează citit',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#tab-mesaje').textContent==='Mesaje');
   assert.notEqual(await actions.getByRole('button',{name:'Marchează necitit',exact:true}).locator('path').getAttribute('d'),unreadIcon);
   await page.getByRole('button',{name:'Marchează necitit',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#tab-mesaje').textContent==='Mesaje (1)');
   await page.evaluate(()=>{for(let i=0;i<25;i++)window.__contactQA.rows.push({id:`extra-${i}`,name:'Test',email:'test@example.invalid',subject:'Mesaj de test',body:'Conținut sintetic',created_at:'2026-10-19T10:00:00Z',is_read:false});});
   await page.locator('#tab-despre').click();await tab.click();
   await page.waitForFunction(()=>document.querySelector('#tab-mesaje').textContent==='Mesaje (26)');
   assert.equal(await page.locator('.contact-message').count(),20);
   assert(await page.locator('[data-contact-pagination]').isVisible());
   assert.equal(await page.locator('[data-contact-page]').textContent(),'1 / 2');
   await page.locator('[data-contact-next]').click();await page.waitForFunction(()=>document.querySelector('[data-contact-page]').textContent==='2 / 2');
   assert.equal(await page.locator('.contact-message').count(),6);
   await page.locator('[data-contact-prev]').click();await page.waitForFunction(()=>document.querySelector('[data-contact-page]').textContent==='1 / 2');
   await page.getByRole('button',{name:'Marchează citit',exact:true}).first().click();await page.waitForFunction(()=>document.querySelector('#tab-mesaje').textContent==='Mesaje (25)');
   await page.locator('.tab-list').screenshot({path:`.qa/messages-tab-${width}.png`});
   await page.locator('[data-contact-next]').click();await page.waitForFunction(()=>document.querySelector('[data-contact-page]').textContent==='2 / 2');
   await page.evaluate(()=>window.__contactQA.rows=[]);await page.locator('[data-contact-refresh]').click();
   await page.waitForFunction(()=>document.querySelector('[data-contact-summary]').textContent==='Niciun mesaj');
   assert.equal(await page.locator('[data-contact-pagination]').isVisible(),false);
   await clickNav(page,'#sign-out');await page.waitForSelector('#tab-mesaje',{state:'hidden'});
   assert.equal(await page.locator('#mesaje').isVisible(),false);assert(page.url().endsWith('#despre'));
   assert.equal(await page.locator('.contact-message').count(),0);assert.equal(await tab.textContent(),'Mesaje','Unread total cleared on logout');
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: private Messages route, hidden visitor tab, keyboard skips hidden tab, exact unread count across pages, read/unread updates, logout cleanup and mobile layout. Synthetic messages only.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
