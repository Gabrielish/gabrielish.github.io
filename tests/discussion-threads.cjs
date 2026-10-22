// Synthetic UI only; hosted authorization/avatar projection is tested with rollback SQL.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>')).replace('comments:[]','comments:window.__qaPosts');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [390,1440]){
  const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://baldursgate3.game/**',r=>r.abort());
  await p.route('https://cdn.discordapp.com/**',r=>r.request().url().includes('broken.png')?r.abort():r.fulfill({contentType:'image/svg+xml',body:fs.readFileSync('assets/discussion-avatar.svg','utf8')}));
  await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test-project.supabase.co',supabasePublishableKey:'public-test'};"}));
  await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await p.addInitScript(()=>{
   const roots=Array.from({length:21},(_,i)=>({id:'root-'+i,author_id:'member',author_name:i===0?'Jucător Discord':'Vizitator '+i,title:'Discuție '+i,body:'O întrebare despre traducere.\nTextul rămâne ușor de urmărit.',status:'approved',parent_id:null,is_guest:i===2,author_avatar_url:i===1?'https://tracker.invalid/image.png':'https://cdn.discordapp.com/avatars/123456789/avatar.png',created_at:new Date(Date.UTC(2026,9,18,0,0,21-i)).toISOString()}));
   const replies=Array.from({length:101},(_,i)=>({id:'reply-'+i,author_id:'other',author_name:'Un răspuns '+i,title:'Re: Discuție 0',body:i===0?'<img src=x onerror=alert(1)> Text simplu.':'Răspuns de test pentru această discuție.',status:'approved',parent_id:'root-0',is_guest:false,author_avatar_url:'https://cdn.discordapp.com/avatars/123456789/broken.png',created_at:new Date(Date.UTC(2026,9,19,0,i)).toISOString()}));
   replies.push({...replies[0],id:'reply-last-page',parent_id:'root-20'});
   window.__qaPosts=[...replies,...roots];
  });
  await p.goto(process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/#discutii',{waitUntil:'networkidle'});
  await p.waitForSelector('#post-reply-0');assert.equal(await p.locator('.post-thread').count(),10);
  assert.equal(await p.locator('#post-root-0 + .post-replies .reply').count(),100);
  assert.equal(await p.locator('#post-root-20').count(),0);assert.equal(await p.locator('#post-reply-last-page').count(),0);
  assert.equal(await p.locator('#post-reply-0 .post-mention').textContent(),'@Jucător Discord');assert.equal(await p.locator('.post-body img').count(),0);
  assert((await p.locator('#post-root-0 .post-avatar').getAttribute('src')).startsWith('https://cdn.discordapp.com/'));
  for(const id of ['root-1','root-2','reply-0'])assert((await p.locator('#post-'+id+' .post-avatar').getAttribute('src')).endsWith('discussion-avatar.svg'));
  await p.locator('.replies-more').click();await p.waitForSelector('#post-reply-100');assert.equal(await p.locator('.replies-more:visible').count(),0);
  const root=await p.locator('#post-root-0').boundingBox(),reply=await p.locator('#post-reply-0').boundingBox();assert(reply.x>root.x);assert(reply.y>root.y);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.evaluate(()=>window.scrollTo(0,document.querySelector('.post-thread').getBoundingClientRect().top+scrollY-130));await p.screenshot({path:`.qa/discussion-threads-${width}.png`});
  await p.getByRole('button',{name:'Pagina 3',exact:true}).click();await p.waitForSelector('#post-reply-last-page');assert.equal(await p.locator('.post-thread').count(),1);assert.equal(await p.locator('#post-reply-0').count(),0);
  await p.getByRole('button',{name:'Pagina 1',exact:true}).click();await p.waitForSelector('#post-reply-0');assert.equal(await p.locator('#post-reply-last-page').count(),0);
  assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS: root-based pagination, chronological nested replies, 100-reply batches, @mention, Discord/fallback/failed avatars, XSS safety, mobile indentation and no overflow. Synthetic SDK.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
