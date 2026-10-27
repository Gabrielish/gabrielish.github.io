const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const {clickNav}=require('./nav-action.cjs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
let sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
sdk=sdk.replace('updates:[]','updates:window.__qaUpdates,releases:window.__qaReleases')
 .replace("project_updates:'updates'","project_updates:'updates',releases:'releases'")
 .replace("key==='updates'||","key==='updates'||key==='releases'||")
 .replace("state[key].filter(matches).forEach(row=>Object.assign(row,this.payload));return{data:null,error:null}","const affected=state[key].filter(matches);affected.forEach(row=>Object.assign(row,this.payload));return{data:affected,error:null}");
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test'};"}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
  await page.addInitScript(()=>{
   window.__qaOwner=true;
   const release={author_name:'Gabrielish',kind:'translation',file_name:'test.rar',file_bytes:100,download_url:'https://github.com/Gabrielish/bg3ro/releases/download/test/test.rar',tags:'Windows'};
   window.__qaReleases=[{...release,id:'latest',title:'Versiunea 20.10.2026',version:'0.7.9',description:'Ultima versiune',published_at:'2026-10-20T12:00:00Z'},{...release,id:'old',title:'Versiunea 18.10.2026',version:'0.8.0',description:'mici corecții',published_at:'2026-10-18T12:00:00Z'}];
   // Even a newer manual post must not displace the pinned latest release.
   window.__qaUpdates=[{id:'manual',author_id:'owner',author_name:'Gabrielish',title:'Act1 și Act 1B revizuite',body:'Anunț manual din 20 octombrie.',published_at:'2026-10-20T14:00:00Z',badge_label:'Act 1',link_label:'',link_url:''}];
  });
  await page.goto('http://127.0.0.1:4173/#actualizari',{waitUntil:'networkidle'});
  const order=()=>page.locator('#updates-feed > article').evaluateAll(nodes=>nodes.map(n=>n.dataset.newsId));
  assert.deepEqual(await order(),['latest','manual','old'],'One chronological DOM order below pinned release');
  assert.equal(await page.locator('#updates-feed .manual-update-toolbar').count(),0,'Visitors cannot edit');
  await clickNav(page,'.topbar [data-auth-open]');await page.locator('#discord-login').click();await page.waitForSelector('#auth-dialog',{state:'hidden'});
  const old=page.locator('[data-news-id=old]'),latest=page.locator('[data-news-id=latest]');
  assert.equal(await latest.getByRole('button',{name:'Editează anunțul versiunii'}).count(),0);
  const snapshot=await page.evaluate(()=>JSON.stringify(window.__communityTest.releases.find(r=>r.id==='old')));
  await old.getByRole('button',{name:'Editează anunțul versiunii'}).click();const modal=old.locator('.update-inline-editor');assert.equal(await old.locator('dialog').count(),0);
  await modal.locator('[name=news_title]').fill('Titlu vechi revizuit');const editor=modal.locator('.discussion-prosemirror');await editor.fill('Corecții de text');await editor.press('ControlOrMeta+a');await modal.getByRole('button',{name:'Listă cu puncte',exact:true}).click();await editor.locator('li p').click();await editor.press('End');await editor.press('Enter');await editor.pressSequentially('Acorduri corectate');
  assert.equal(await editor.locator('li').count(),2,await editor.innerHTML());
  await modal.locator('[name=news_badge]').fill('Revizie');await modal.getByRole('button',{name:'Salvează anunțul'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-news-id=old] .post-title')?.textContent==='Titlu vechi revizuit');
  assert.deepEqual(await order(),['latest','manual','old']);
  assert.equal(await old.locator('.release-version-badge').textContent(),'Revizie');
  assert.equal(await old.locator('.rich-content li').count(),2);
  assert.equal(await page.locator('#translation-releases .release-head > div > h2').first().textContent(),'Versiunea 20.10.2026','Current download unchanged');
  const result=await page.evaluate(()=>{const r={...window.__communityTest.releases.find(r=>r.id==='old')};delete r.news_title;delete r.news_body;delete r.news_badge;return JSON.stringify(r);});
  assert.equal(result,snapshot,'Archive name, URL, version, original text and date remain unchanged');
  const boxes=await page.locator('#updates-feed > article').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().y));assert(boxes[0]<boxes[1]&&boxes[1]<boxes[2]);
  await page.locator('#updates-feed').screenshot({path:`.qa/news-history-${width}.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: pinned latest release, interleaved chronological DOM order, archived announcement title/body/badge editing, rich content and unchanged archive metadata at 320/390/1440px.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
