const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const {clickNav}=require('./nav-action.cjs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'))
 .replace('comments:[]','comments:window.__badgePosts').replace('reports:[]','reports:window.__badgeReports')
 .replace('updates:[]','updates:window.__badgeUpdates,releases:window.__badgeReleases')
 .replace("project_updates:'updates'","project_updates:'updates',releases:'releases'")
 .replace("key==='updates'||","key==='updates'||key==='releases'||");
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,1440]){
 const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://baldursgate3.game/**',r=>r.abort());
 await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test'}"}));
 await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
 await p.addInitScript(()=>{
  window.__qaOwner=true;
  const common={author_id:'owner',author_name:'gabrielish',body:'Un mesaj de test pentru insigna administratorului.',status:'approved',is_guest:false,author_is_admin:true,created_at:'2026-10-24T09:00:00Z',title:'Test Admin'};
  window.__badgePosts=[{...common,id:'admin-root',parent_id:null},{...common,id:'admin-reply',parent_id:'admin-root'},{...common,id:'member',parent_id:null,author_id:'alice',author_name:'Admin',author_is_admin:false},{...common,id:'guest',parent_id:null,is_guest:true,author_is_admin:true}];
  window.__badgeReports=[{...common,id:'admin-report',status:'new',is_public:true,moderator_reply:'Răspunsul administratorului.',reply_author_name:'gabrielish',reply_created_at:common.created_at}];
  window.__badgeUpdates=[{...common,id:'manual',published_at:common.created_at}];
  window.__badgeReleases=[{...common,id:'release',kind:'translation',version:'test',file_name:'test.rar',file_bytes:128,download_url:'https://github.com/Gabrielish/bg3ro/releases/download/test/test.rar',description:common.body,published_at:common.created_at,tags:'Windows'}];
 });
 await p.goto('http://127.0.0.1:4173/#discutii',{waitUntil:'networkidle'});
 await p.locator('#post-admin-root').waitFor();assert.equal(await p.locator('#post-admin-root>.avatar-with-role>.avatar-admin-badge').textContent(),'Admin');
 assert.equal(await p.locator('#post-admin-reply>.avatar-with-role>.avatar-admin-badge').count(),1);
 assert.equal(await p.locator('#post-member .avatar-admin-badge,#post-guest .avatar-admin-badge').count(),0,'Name or guest flags cannot spoof an Admin badge');
 assert.equal(await p.locator('#discussion-avatar').evaluate(n=>n.parentElement.classList.contains('avatar-with-role')),false);
 await p.locator('#post-admin-root').screenshot({path:`.qa/admin-avatar-${width}.png`});
 for(const badge of await p.locator('#discussion-list .avatar-admin-badge').all()){
  const bounds=await badge.boundingBox(),image=await badge.locator('..').locator('img').boundingBox();assert(Math.abs(bounds.x+bounds.width/2-image.x-image.width/2)<1,'Badge centered under avatar');assert(bounds.y<image.y+image.height&&bounds.y+bounds.height>image.y+image.height,'Badge overlaps lower rim');
 }
 await p.locator('#tab-erori').click();assert.equal(await p.locator('#reports-list .avatar-admin-badge').count(),2,'Report author and administrator reply have badges');
 await p.locator('#tab-actualizari').click();assert.equal(await p.locator('#updates-feed .avatar-admin-badge').count(),2,'Manual and automatic announcements have badges');
 await clickNav(p,'.topbar [data-auth-open]');await p.locator('#auth-consent').check();await p.locator('#discord-login').click();await p.waitForSelector('#auth-dialog',{state:'hidden'});
 assert.equal(await p.locator('#discussion-avatar').evaluate(n=>n.parentElement.classList.contains('avatar-with-role')),true);
 await clickNav(p,'#sign-out');await p.waitForFunction(()=>!document.querySelector('#discussion-avatar').parentElement.classList.contains('avatar-with-role'));
 assert.equal(await p.locator('#updates-feed .avatar-admin-badge').count(),2,'Public administrator badges remain after viewer logout');
 assert.deepEqual(errors,[]);await p.close();
}console.log('PASS: verified Admin avatar badges on public posts, replies, reports and announcements; spoof rejection, mobile positioning and composer logout cleanup.');}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
