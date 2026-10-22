const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'))
 .replace('comments:[],reports:[]','comments:window.__comments,reports:window.__reports')
 .replace('limit(){return this}','limit(n){this.limitCount=n;return this}')
 .replace('const count=data.length;if(this.bounds)','const count=data.length;if(this.limitCount)data=data.slice(0,this.limitCount);if(this.bounds)');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.addInitScript(()=>{
   const base={author_id:'other',author_name:'Test',body:'Conținut sintetic pentru testare.',created_at:'2026-10-21T00:00:00Z'};
   window.__comments=Array.from({length:25},(_,i)=>({...base,id:`post-${i}`,title:`Discuție ${i}`,parent_id:null,status:'approved'}));
   window.__comments.push({...base,id:'reply',title:'Re: Discuție',parent_id:'post-0',status:'approved'});
   window.__reports=Array.from({length:23},(_,i)=>({...base,id:`report-${i}`,title:`Eroare ${i}`,is_public:true,status:'new',platform:'windows',mod_version:'test'}));
   window.__reports.push({...base,id:'private',title:'Privată',is_public:false,status:'new'});
  });
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'};"}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await page.goto('http://127.0.0.1:4173/#discutii',{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
  assert.equal(await page.locator('#tab-discutii').textContent(),'Discuții (25)','Total threads, excluding replies and not limited to the current page');
  assert.equal(await page.locator('#discussion-list > .post-thread').count(),10);
  await page.locator('#discussion-pages button').filter({hasText:/^3$/}).click();await page.waitForFunction(()=>document.querySelectorAll('#discussion-list > .post-thread').length===5);
  assert.equal(await page.locator('#tab-discutii').textContent(),'Discuții (25)');
  await page.locator('#tab-erori').click();
  assert.equal(await page.locator('#tab-erori').textContent(),'Raportare erori (23)','Private records remain excluded for guests');
  assert.equal(await page.locator('#reports-list > .report-item').count(),20);
  await page.locator('#more-reports').click();await page.waitForFunction(()=>document.querySelectorAll('#reports-list > .report-item').length===23);
  assert.equal(await page.locator('#tab-erori').textContent(),'Raportare erori (23)');
  assert.equal(await page.locator('#discussion-count').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.close();
 }
 console.log('PASS: tab totals across pagination, replies excluded, private reports protected, no duplicate counter, mobile/desktop layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
