const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./information-pages.cjs'),'utf8');
const {clickNav}=require('./nav-action.cjs');
const sdk=source.slice(source.indexOf('function fakeSDK(){'),source.indexOf('\n(async()=>')).replace('auth:{getSession:',"auth:{signOut:async()=>{state.user=null;callback('SIGNED_OUT',null);return{error:null};},getSession:");
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [390,1440])for(const owner of [false,true]){
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
   assert.equal(await page.locator('[data-contact-pagination]').isVisible(),false);
   await page.locator('.inbox-header').screenshot({path:`.qa/inbox-header-${width}.png`});
   assert.equal(await page.locator('.contact-message img').count(),0);
   await page.getByRole('button',{name:'Marchează citit',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#tab-mesaje').textContent==='Mesaje');
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
