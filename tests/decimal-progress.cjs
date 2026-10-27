const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),{clickNav}=require('./nav-action.cjs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8'),sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1440]){
 const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 await p.route('https://baldursgate3.game/**',r=>r.abort());
 await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'}"}));
 await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
 await p.addInitScript(()=>window.__qaOwner=true);
 await p.goto('http://127.0.0.1:4173/#despre',{waitUntil:'networkidle'});
 await clickNav(p,'.topbar [data-auth-open]');await p.locator('#discord-login').click();
 await p.getByRole('button',{name:'Editează Progresul traducerii',exact:true}).click();
 let form=p.locator('[data-about-section=progress] form'),input=form.locator('[name=translation_percent]');
 assert.equal(await input.getAttribute('step'),'0.01');
 for(const value of ['-0.01','100.01','79.611']){await input.fill(value);assert.equal(await input.evaluate(e=>e.checkValidity()),false);}
 await input.fill('79.61');assert(await input.evaluate(e=>e.checkValidity()));
 await form.locator('[name=review_percent]').fill('20.25');await form.locator('[name=testing_percent]').fill('0.01');
 await form.getByRole('button',{name:'Salvează',exact:true}).click();await form.waitFor({state:'detached'});
 for(const [kind,value]of [['translation','79.61'],['review','20.25'],['testing','0.01']]){
  assert.equal(await p.locator('#'+kind+'-percent').textContent(),value+'%');
  assert.equal(await p.locator('#'+kind+'-progress').getAttribute('aria-valuenow'),value);
  assert.equal(await p.locator('#'+kind+'-progress .progress-fill').evaluate(e=>e.style.width),value+'%');
 }
 await p.getByRole('button',{name:'Editează Progresul traducerii',exact:true}).click();form=p.locator('[data-about-section=progress] form');
 assert.equal(await form.locator('[name=translation_percent]').inputValue(),'79.61');
 await form.locator('[name=translation_percent]').fill('80');await form.getByRole('button',{name:'Salvează',exact:true}).click();await form.waitFor({state:'detached'});
 assert.equal(await p.locator('#translation-percent').textContent(),'80%');await p.close();
}console.log('PASS: decimal progress editing/persistence, exact labels/bar widths/ARIA, integer display and bounds/precision validation on mobile and desktop.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
