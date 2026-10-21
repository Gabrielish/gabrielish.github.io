const {clickNav}=require('./nav-action.cjs');
// Synthetic UI data only. Actual database permissions are tested in releases-access.sql.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
let sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
sdk=sdk.replace('comments:[],reports:[],updates:[]','comments:[],reports:[],updates:[],releases:window.__qaReleases||[]')
  .replace("project_updates:'updates'","project_updates:'updates',releases:'releases'")
  .replace('state[key].unshift(row);return{data:null,error:null}',"state[key].unshift(row);return{data:key==='releases'?[row]:null,error:null}")
  .replace('return{data:null,error:null}}',"return{data:key==='releases'?state[key].filter(matches):null,error:null}}")
  .replace("key==='updates'||","key==='updates'||key==='releases'||");
sdk=sdk.replace('const client={',`const client={functions:{invoke:async(_name,options)=>{
 if(state.failInsert)return{error:{context:{json:async()=>({message:'Configurează GITHUB_UPLOAD_TOKEN.'})}}};
 return{data:{file_name:options.body.name,file_bytes:options.body.size,download_url:"https://raw.githubusercontent.com/Gabrielish/bg3ro/${'a'.repeat(40)}/Baldur's%20Gate%203%20Romanian%20Translate/"+encodeURIComponent(options.body.name),message:'Arhiva a fost încărcată.'},error:null};
}},`);
(async()=>{
  fs.mkdirSync('.qa',{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const owner of [false,true]){
      const p=await browser.newPage({viewport:{width:owner?1440:390,height:1000},reducedMotion:'reduce'});
      await p.route('https://baldursgate3.game/**',r=>r.abort());
      await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test-project.supabase.co',supabasePublishableKey:'test-key'};"}));
      await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
      await p.addInitScript(isOwner=>{window.__qaOwner=isOwner;window.__qaReleases=['translation','search','item_gender','combat_log'].map((kind,i)=>({id:`test-${i}`,author_name:'Gabrielish',kind,version:'0.1',title:`Versiune de test ${kind}`,file_name:`test-${kind}.zip`,file_bytes:1048576,download_url:`https://github.com/Gabrielish/bg3ro/releases/download/test/test-${kind}.zip`,tags:'Windows, Early Access',description:'Descriere sintetică, nu o versiune reală.',published_at:'2026-10-17T12:00:00Z'}));},owner);
      const errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto(process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});
      await p.waitForSelector('#updates-feed .release-news',{state:'attached'});
      assert.equal(await p.locator('#updates-feed .release-news').count(),1,'Only localization appears in Updates');
      assert((await p.locator('#updates-feed').textContent()).includes('Versiune de test translation'));
      for(const kind of ['search','item_gender','combat_log'])assert(!(await p.locator('#updates-feed').textContent()).includes(`Versiune de test ${kind}`),'Mod announcements are excluded');
      assert.deepEqual(await p.locator('#compatibility-version option').evaluateAll(nodes=>nodes.map(n=>n.value)),['','0.1'],'Version dropdown uses published base translations only');
      const badge=p.locator('#updates-feed .release-version-badge').first();
      assert.equal(await badge.textContent(),'Versiunea 0.1');
      assert.equal(await badge.locator('svg[aria-hidden="true"] path').count(),1);
      assert.deepEqual(await badge.evaluate(el=>{const s=getComputedStyle(el);return [s.borderRadius,s.padding,s.fontSize,s.lineHeight,s.gap,s.color];}),['9999px','2px 8px','12px','16px','4px','oklch(0.723 0.219 149.579)']);
      assert.equal(await p.locator('#extra-releases .release-card').count(),3);
      assert.equal(await p.locator('#extra-releases .release-card-mod').count(),3);
      assert.equal(await p.locator('#extra-releases .release-notes,#extra-releases .release-notes-title').count(),0,'Mods have no nested changelog or duplicate title');
      assert.equal(await p.locator('#extra-releases .release-description').count(),3,'Each mod keeps its description');
      assert.equal(await p.locator('#extra-releases .release-download').count(),3,'All downloads remain available');
      assert.equal(await p.locator('#extra-releases .release-card').first().evaluate(el=>getComputedStyle(el).padding),owner?'20px 22px':'18px');
      assert.equal(await p.locator('#release-editor:visible').count(),0);
      assert.equal(await p.locator('.hero-cta').getAttribute('href'),'#descarcari');
      assert.equal(await p.locator('.hero-cta').getAttribute('download'),null);
      assert.equal(await p.locator('.hero-cta').getAttribute('data-release-id'),null,'Navigation is not a download event');
      assert.match(await p.locator('#github-quick-download').getAttribute('href'),/test-translation.zip/);
      await p.locator('.hero-cta').click();
      assert.equal(await p.evaluate(()=>location.hash),'#descarcari');
      assert(await p.locator('#descarcari').isVisible());
      const latestBox=await p.locator('#translation-releases').boundingBox();
      assert(latestBox.y>=0 && latestBox.y<950,'Hero scrolls to the latest translation');
      const downloadButton=p.locator('#translation-releases .release-download');
      assert.equal(await downloadButton.textContent(),'Descarcă fișier ZIP');
      assert.equal(await downloadButton.locator('svg[aria-hidden="true"]').count(),1);
      assert.equal(await downloadButton.getAttribute('download'),'test-translation.zip');
      assert.equal(await downloadButton.evaluate(el=>getComputedStyle(el).backgroundImage),'none');
      assert.equal(await downloadButton.evaluate(el=>getComputedStyle(el).backgroundColor),await p.locator('#github-quick-download').evaluate(el=>getComputedStyle(el).backgroundColor),'Same cream as sidebar download');
      assert.equal(await downloadButton.evaluate(el=>getComputedStyle(el).color),'rgb(23, 21, 15)');
      const restingGlow=await downloadButton.evaluate(el=>getComputedStyle(el).boxShadow);
      await downloadButton.hover();assert.equal(await downloadButton.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
      assert.notEqual(await downloadButton.evaluate(el=>getComputedStyle(el).boxShadow),restingGlow,'Warm glow increases on hover');
      await p.mouse.move(0,0);
      assert.equal(await p.locator('#translation-releases .release-notes h3 svg').count(),1);
      assert.equal(await p.locator('#translation-releases .release-notes-title').textContent(),'Versiune de test translation');
      assert.equal(await p.locator('#updates-feed .release-news .post-title').textContent(),'Versiune de test translation');
      assert.equal(await p.locator('#updates-feed .release-news a[download]').count(),0);
      assert.equal(await p.locator('#updates-feed .release-news .btn').count(),0);
      assert.equal(await p.locator('#updates-feed .release-author-avatar').count(),1);
      const newsLink=p.locator('#updates-feed .release-news-link');
      assert.equal(await newsLink.textContent(),'Descărcări');
      assert.equal(await newsLink.getAttribute('href'),'#descarcari');
      assert.equal(await newsLink.locator('svg[aria-hidden=true] path').count(),1);
      assert.equal(await newsLink.evaluate(el=>getComputedStyle(el,'::before').content),'none','Separator is not part of the link');
      assert.equal(await p.locator('#updates-feed .release-news-separator').textContent(),'·');
      assert.equal(await p.locator('#updates-feed .post-content .post-title').count(),1);
      assert.equal(await p.locator('#updates-feed .post > .post-avatar').count(),1);
      assert.equal(await p.locator('#updates-feed .post-meta').evaluate(el=>getComputedStyle(el).marginBottom),'12px');
      assert.equal(await p.locator('#updates-feed .post').evaluate(el=>getComputedStyle(el).gap),owner?'16px':'10px');
      assert.equal(await p.locator('#translation-releases .release-notes').evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
      const nexusRestingBackground=await p.locator('.quick-download a[href*="nexusmods"]').evaluate(el=>getComputedStyle(el).backgroundColor);
      assert.equal(nexusRestingBackground,'rgb(24, 25, 25)');
      assert.equal(await p.locator('#translation-releases .release-notes').evaluate(el=>getComputedStyle(el).backgroundColor),nexusRestingBackground,'Release notes match the non-hovered Nexus button');
      await p.locator('#translation-releases .release-notes').hover();
      assert.equal(await p.locator('#translation-releases .release-notes').evaluate(el=>getComputedStyle(el).backgroundColor),nexusRestingBackground,'Release notes do not acquire a button hover state');
      assert.equal(await p.locator('#translation-releases .release-notes').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(57, 52, 41)','Subtle warm gold border');
      const earlyAccessBox=await p.locator('.quick-download .small').boundingBox(),nexusBox=await p.locator('.quick-download a[href*="nexusmods"]').boundingBox();
      assert(earlyAccessBox.y-(nexusBox.y+nexusBox.height)>=11.5,'Early Access label has space above it');
      assert.equal(await p.locator('#release-load-status').isVisible(),false,'Empty status must not shift the release');
      assert.equal(await p.locator('#translation-releases a[href*="nexusmods"]').count(),0,'Nexus download belongs only in the sidebar');
      if(owner){
        const left=await p.locator('#translation-releases .release-card').first().boundingBox(),right=await p.locator('.quick-download').boundingBox();
        assert(Math.abs(left.y-right.y)<=1,'Download release and sidebar must have aligned top borders');
      }
      assert.match(await p.locator('#translation-releases .release-file').textContent(),/test-translation.zip · 1 MB/);
      assert.equal(await p.locator('.release-edit:visible').count(),0);
      await clickNav(p,'.topbar [data-auth-open]');await p.locator('#auth-consent').check();await p.locator('#discord-login').click();await p.waitForFunction(()=>!document.querySelector('#sign-out').hidden);
      if(owner){
        await p.waitForSelector('#release-editor',{state:'visible'});
        const downloadBox=await p.locator('#translation-releases .release-actions > a').boundingBox();
        const pencilBox=await p.locator('#translation-releases .release-actions > .edit-control > button').boundingBox();
        assert(pencilBox.x>=downloadBox.x+downloadBox.width,'Pencil sits to the right of download');
        assert(Math.abs(pencilBox.y-downloadBox.y)<1,'Download and pencil share top alignment');
        await p.locator('#translation-releases .edit-control > .edit-pencil').click();
        await p.locator('#translation-releases .edit-dialog input[name=title]').fill('Titlul ales de administrator');
        await p.locator('#translation-releases textarea').fill('<img src=x onerror=alert(1)> Notă editată.');
        await p.locator('#translation-releases .edit-dialog form button').click();
        await p.waitForFunction(()=>document.querySelector('#updates-feed').textContent.includes('Notă editată.'));
        assert.equal(await p.locator('#updates-feed .post-body img').count(),0);
        assert.equal(await p.locator('#updates-feed .release-news .post-title').textContent(),'Titlul ales de administrator');
        assert.equal(await p.locator('#translation-releases .release-notes-title').textContent(),'Titlul ales de administrator');
        await p.locator('#release-editor summary').click();
        await p.locator('#release-version').fill('0.2');await p.locator('#release-title').fill('Versiune nouă de test');
        await p.locator('#release-archive').setInputFiles({name:'new.zip',mimeType:'application/zip',buffer:Buffer.alloc(2097152)});
        await p.evaluate(()=>window.__communityTest.failInsert=true);await p.locator('#upload-release-file').click();
        await p.waitForFunction(()=>document.querySelector('#release-upload-status').textContent.includes('GITHUB_UPLOAD_TOKEN'));
        assert.equal(await p.locator('#release-url').inputValue(),'');
        await p.evaluate(()=>window.__communityTest.failInsert=false);await p.locator('#upload-release-file').click();
        await p.waitForFunction(()=>document.querySelector('#release-file-name').value==='new.zip');
        assert.equal(await p.locator('#release-file-bytes').inputValue(),'2097152');
        await p.locator('#release-description').fill('Modificări de test pentru versiunea 0.2.');
        await p.locator('#release-publish-form button').click();
        await p.waitForFunction(()=>document.querySelector('#updates-feed').textContent.includes('Versiune nouă de test'));
        assert.deepEqual(await p.locator('#compatibility-version option').evaluateAll(nodes=>nodes.map(n=>n.value)),['','0.2','0.1'],'New publications update the compatibility dropdown');
        assert.match(await p.locator('#translation-releases .release-head > div:not(.release-actions) > h2').textContent(),/Versiune nouă de test/);
        await p.locator('.hero-cta').click();assert.equal(await p.locator('.hero-cta').getAttribute('href'),'#descarcari');
        assert(await p.locator('#translation-releases .release-head > div:not(.release-actions) > h2').isVisible(),'Hero continues navigating to the latest version after publication');
        await p.locator('#tab-actualizari').click();
        await p.locator('#updates-feed').screenshot({path:'.qa/releases-updates-desktop.png'});
        await p.locator('#updates-feed a').first().click();assert(await p.locator('#descarcari').isVisible());
      }else assert.equal(await p.locator('#release-editor:visible').count(),0,'Discord profile metadata cannot grant publishing rights');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await p.locator('#descarcari').screenshot({path:`.qa/releases-downloads-${owner?'desktop':'mobile'}.png`});
      await clickNav(p,'#sign-out');await p.waitForSelector('#sign-out',{state:'hidden'});
      assert.equal(await p.locator('.release-edit:visible').count(),0);
      assert.deepEqual(errors,[]);await p.close();
    }
    console.log('PASS: linked release/news cards, metadata, publication/edit synchronization, safe text, owner UI, anonymous downloads, mobile layout and logout. Synthetic SDK; no real files uploaded.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
