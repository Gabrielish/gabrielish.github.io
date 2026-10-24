const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./information-pages.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function fakeSDK(){'),source.indexOf('\n(async()=>'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1440])for(const owner of [false,true]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://baldursgate3.game/**',r=>r.abort());await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));await page.addInitScript(value=>window.__qaContactOwner=value,owner);
 await page.goto('http://127.0.0.1:4173/#conversatii',{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
 if(owner){await page.locator('a[href="#conversatii/demo-1"]').waitFor();assert.equal(await page.locator('.dm-conversation').count(),4);await page.locator('a[href="#conversatii/demo-1"]').click();await page.locator('.dm-message').first().waitFor();assert.equal(await page.locator('.dm-message').count(),3);
 await page.locator('.dm-form .discussion-prosemirror').fill('Răspuns local de test.');await page.locator('.dm-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('.dm-message').length===4);assert((await page.locator('.dm-message').last().textContent()).includes('Răspuns local de test.'));await page.locator('#conversatii').screenshot({path:`.qa/messages-demo-${width}.png`});assert(await page.locator('#conversatii').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.reload({waitUntil:'networkidle'});await page.locator('.dm-message').first().waitFor();assert.equal(await page.locator('.dm-message').count(),3);
 }else{assert.equal(await page.locator('.dm-conversation').count(),0);await page.evaluate(()=>location.hash='conversatii/demo-1');assert.equal(await page.locator('.dm-message').count(),0);}
 assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS: four admin-only demo conversations, local reply, reload reset, guest isolation, responsive layout.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
