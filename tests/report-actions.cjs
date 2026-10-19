const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const {clickNav}=require('./nav-action.cjs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>')).replace('reports:[]',"reports:[{id:'qa-report',title:'Raport de test',body:'Un mesaj sintetic pentru verificarea formularului.',status:'new',platform:'windows',mod_version:'test',is_public:true,author_name:'Jucător',created_at:'2026-10-19T10:00:00Z'}]");
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test'};"}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await page.addInitScript(()=>window.__qaOwner=true);
  await page.goto('http://127.0.0.1:4173/#erori',{waitUntil:'networkidle'});
  await clickNav(page,'.topbar [data-auth-open]');await page.locator('#auth-consent').check();await page.locator('#discord-login').click();
  await page.waitForSelector('#auth-dialog',{state:'hidden'});
  const select=page.locator('.report-item select'),actions=page.locator('.report-actions');
  const style=await select.evaluate(el=>{const s=getComputedStyle(el);return {appearance:s.appearance,image:s.backgroundImage,position:s.backgroundPosition,padding:s.paddingRight};});
  assert.equal(style.appearance,'none');assert(style.image.includes('select-chevron.svg'));assert.equal(style.padding,'44px');assert(style.position.includes('14px'));
  assert.equal(await actions.locator('svg[aria-hidden=true]').count(),2);
  const save=actions.getByRole('button',{name:'Salvează răspunsul'}),remove=actions.getByRole('button',{name:'Șterge raportul'});
  const a=await save.boundingBox(),b=await remove.boundingBox();assert(Math.abs(a.y-b.y)<1&&b.x>=a.x+a.width,'Buttons share a row');
  await select.selectOption('resolved');await page.locator('.report-item textarea').fill('Răspuns de test.');await save.click();
  await page.waitForFunction(()=>window.__communityTest.reports[0].status==='resolved');
  await page.locator('.report-item').screenshot({path:`.qa/report-actions-${width}.png`});
  page.once('dialog',d=>d.dismiss());await remove.click();assert.equal(await page.locator('.report-item').count(),1);
  page.once('dialog',d=>d.accept());await remove.click();await page.waitForFunction(()=>window.__communityTest.reports.length===0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: inset dropdown chevron; icon buttons share a row at 320/390/1440px; save, delete cancellation/confirmation and no JS errors. Synthetic reports only.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
