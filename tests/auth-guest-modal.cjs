const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const {clickNav}=require('./nav-action.cjs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test'};"}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await page.goto('http://127.0.0.1:4173/#erori',{waitUntil:'networkidle'});
  await page.waitForSelector('html.portal-ready');
  await page.locator('#erori .auth-required').screenshot({path:`.qa/auth-gate-${width}.png`});
  assert(!(await page.locator('#erori .auth-required').textContent()).includes('Trimite o raportare publică'));
  await page.locator('#erori [data-auth-open]').click();
  assert((await page.locator('#auth-dialog .dialog-copy').textContent()).includes('ca oaspete'));
  assert.equal(await page.locator('#auth-consent').isChecked(),false);
  await page.locator('#auth-dialog').screenshot({path:`.qa/auth-guest-modal-${width}.png`});
  await page.locator('#auth-guest').click();
  await page.waitForSelector('#auth-dialog',{state:'hidden'});await page.waitForSelector('#report-form',{state:'visible'});
  assert.equal(new URL(page.url()).hash,'#erori');
  assert.equal(await page.evaluate(()=>window.__communityTest.guestCalls),1);
  assert(await page.locator('#report-name').isVisible());
  assert.equal(await page.locator('#admin-tools:visible').count(),0);
  await page.locator('[data-rating="4"]').click();await page.waitForSelector('#auth-dialog',{state:'visible'});
  await page.locator('#auth-guest').click();await page.waitForSelector('#auth-dialog',{state:'hidden'});
  assert.equal(await page.evaluate(()=>window.__communityTest.guestCalls),1,'Existing guest is reused');
  await clickNav(page,'#sign-out');await page.waitForSelector('#sign-out',{state:'hidden'});
  await page.locator('#tab-despre').click();await clickNav(page,'.topbar [data-auth-open]');await page.locator('#auth-guest').click();
  await page.waitForSelector('#discussion-form',{state:'visible'});assert.equal(new URL(page.url()).hash,'#discutii');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: compact access gate and guest modal at 320/390/1440px, report/discussion routing, guest reuse, no extra Discord requirement or admin access.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
