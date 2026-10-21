const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'))
 .replace('user:null,comments:[]','user:window.__initialUser||null,comments:[]')
 .replace('state.guestCalls=(state.guestCalls||0)+1;','state.guestCalls=(state.guestCalls||0)+1;if(window.__guestFailure)return{data:{session:null},error:{message:"Network failure"}};');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const mode of ['member','guest','disabled','failure']){
  const page=await browser.newPage({viewport:{width:1440,height:950},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(mode=>{
   window.__initialUser=mode==='member'?{id:'alice',user_metadata:{full_name:'Discord salvat'}}:mode==='guest'?{id:'guest',is_anonymous:true,user_metadata:{}}:null;
   window.__guestFailure=mode==='failure';
  },mode);
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:`window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test',authEnabled:${mode!=='disabled'}};`}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await page.goto('http://127.0.0.1:4173/#discutii',{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
  assert.equal(await page.evaluate(()=>window.__communityTest.guestCalls||0),mode==='failure'?1:0,'No redundant anonymous user for '+mode);
  if(mode==='member'){
   assert.equal(await page.locator('#discussion-name').inputValue(),'Discord salvat');
   assert.equal(await page.locator('#discussion-name').isEditable(),false);
   assert.equal(await page.locator('#sign-out').evaluate(el=>el.hidden),false);
  }else if(mode==='guest'){
   assert(await page.locator('#discussion-form').isVisible());
   assert.equal(await page.locator('#sign-out').evaluate(el=>el.hidden),true);
  }else if(mode==='failure'){
   assert.equal(await page.locator('#discussion-form').isVisible(),false,'No fake success when anonymous Auth fails');
   assert(await page.locator('#discutii [data-auth-gate]').isVisible(),'Retry fallback remains available');
   await page.evaluate(()=>window.__guestFailure=false);
   await page.locator('[data-guest-start=discussion]').click();
   await page.waitForSelector('#discussion-form',{state:'visible'});
   assert.equal(await page.evaluate(()=>window.__communityTest.guestCalls),2,'One deliberate retry');
  }else assert.equal(await page.locator('#discussion-form').isVisible(),false);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: saved Discord/guest identities reused, Auth-disabled respected, anonymous failure preserves public page and supports retry.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
