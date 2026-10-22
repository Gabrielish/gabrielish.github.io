const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>')).replace('comments:[]','comments:window.__seedPosts');
const moduleSource=`export const createClient=()=>{
 const client=(${sdk})(),base=client.rpc;window.__reactionClient=client;
 const state=window.__communityTest;state.reactions=[{post_id:'root-one',user_id:'other',emoji:'like'}];
 client.rpc=async(name,args)=>{
  if(name==='bg3ro_reaction_summary'){
   const rows=[];for(const r of state.reactions.filter(r=>args.p_post_ids.includes(r.post_id))){let row=rows.find(row=>row.post_id===r.post_id&&row.emoji===r.emoji);if(!row){row={post_id:r.post_id,emoji:r.emoji,total:0,mine:false};rows.push(row);}row.total++;row.mine||=r.user_id===state.user?.id;}return{data:rows,error:null};
  }
  if(name==='bg3ro_toggle_reaction'){
   if(state.failReaction)return{error:{message:'Network error'}};
   const old=state.reactions.find(r=>r.post_id===args.p_post_id&&r.user_id===state.user.id);
   state.reactions=state.reactions.filter(r=>r!==old);if(old?.emoji!==args.p_emoji)state.reactions.push({post_id:args.p_post_id,user_id:state.user.id,emoji:args.p_emoji});return{error:null};
  }return base(name,args);
 };return client;
};`;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__seedPosts=['root-one','root-two'].map((id,i)=>({id,author_id:'other',author_name:i?'Daria':'Alex',title:'Legacy title',body:'Un comentariu sintetic pentru testarea răspunsurilor.',parent_id:null,status:'approved',is_guest:true,created_at:`2026-10-22T12:00:0${i}Z`}));});
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'};"}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:moduleSource}));
  await page.goto('http://127.0.0.1:4173/#discutii',{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
  const root=page.locator('#post-root-one'),editor=page.locator('#reply-discussion-editor .discussion-prosemirror'),mainEditor=page.locator('#discussion-editor .discussion-prosemirror');
  await root.locator('.reaction-count').filter({hasText:'👍 1'}).waitFor();
  const trigger=root.locator('.reaction-trigger');await trigger.click();
  const menu=page.locator('.reaction-picker:popover-open');await menu.waitFor();assert.equal(await menu.locator('button').count(),6);
  const bounds=await menu.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width);
  await page.addStyleTag({content:'.topbar{visibility:hidden!important}'});
  await page.screenshot({path:`.qa/reaction-picker-${width}.png`});
  await menu.getByRole('button',{name:'Ador',exact:true}).click();await root.locator('.reaction-count').filter({hasText:'❤️ 1'}).waitFor();
  assert.equal(await root.locator('.reaction-count').filter({hasText:'❤️ 1'}).getAttribute('aria-pressed'),'true');
  await trigger.click();await page.locator('.reaction-picker:popover-open').getByRole('button',{name:'Amuzant',exact:true}).click();
  await root.locator('.reaction-count').filter({hasText:'😂 1'}).waitFor();assert.equal(await root.locator('.reaction-count').filter({hasText:'❤️'}).count(),0);
  await root.locator('.reaction-count').filter({hasText:'😂 1'}).click();await page.waitForFunction(()=>!document.querySelector('#post-root-one .reaction-count[aria-pressed=true]'));
  assert.equal(await root.locator('.reaction-count').count(),1,'Other account reaction is unchanged');
  await trigger.click();await page.keyboard.press('ArrowRight');assert.equal(await page.locator(':focus').getAttribute('data-reaction'),'love');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.reaction-picker:popover-open'));
  await page.evaluate(()=>window.__communityTest.failReaction=true);await trigger.click();await menu.getByRole('button',{name:'Trist',exact:true}).click();
  assert((await root.locator('.reaction-status').textContent()).includes('nu a fost salvată'));assert.equal(await root.locator('.reaction-count').count(),1);
  await page.keyboard.press('Escape');await page.evaluate(()=>window.__communityTest.failReaction=false);
  await trigger.click();await menu.getByRole('button',{name:'Ador',exact:true}).click();
  await root.locator('.reaction-count').filter({hasText:'❤️ 1'}).waitFor();
  await root.locator(':scope > .post-content > .post-actions').getByRole('button',{name:'Răspunde',exact:true}).click();
  assert(await root.locator('#reply-discussion-form.is-inline-reply').isVisible());assert(await page.locator('.discussion-compose').isVisible(),'Main composer MUST remain visible');
  assert((await page.locator('#reply-reply-label').textContent()).includes('@Alex'));assert.equal(await page.locator('#reply-discussion-form button[type=submit]').textContent(),'Răspunde');
  await page.locator('#reply-discussion-name').fill('Vizitator');await editor.fill('Un răspuns pe care vreau să îl păstrez.');
  await mainEditor.fill('Ciornă independentă pentru un comentariu nou.');
  await page.locator('#post-root-two > .post-content > .post-actions').getByRole('button',{name:'Răspunde',exact:true}).click();
  assert(await page.locator('#post-root-two #reply-discussion-form').isVisible());assert((await editor.innerText()).includes('vreau să îl păstrez'));
  await page.locator('#reply-cancel-reply').click();assert(await page.locator('#discussion-composer-home #discussion-form').isVisible());assert((await mainEditor.innerText()).includes('Ciornă independentă'));
  await root.locator(':scope > .post-content > .post-actions').getByRole('button',{name:'Citat',exact:true}).click();
  assert.equal(await editor.locator('blockquote').count(),1);
  await page.evaluate(()=>window.__originalEditor=window.BG3RO_REPLY_EDITOR.editor);
  await page.getByRole('button',{name:'Pagina 1',exact:true}).click();
  assert(await page.locator('#post-root-one #reply-discussion-form').isVisible());
  await page.locator('#post-root-one .reaction-count').filter({hasText:'❤️ 1'}).waitFor();
  assert(await page.evaluate(()=>window.__originalEditor===window.BG3RO_REPLY_EDITOR.editor),'Rerender retains the live reply editor instance');
  assert((await mainEditor.innerText()).includes('Ciornă independentă'),'Rerender retains the separate main draft');
  for(const label of ['Răspunde','Citat','Link'])assert.equal(await root.locator('>.post-content>.post-actions').getByRole('button',{name:label,exact:true}).locator('svg').count(),1);
  await page.locator('#discussion-form').screenshot({path:`.qa/main-composer-${width}.png`});
  await page.locator('#reply-discussion-form').screenshot({path:`.qa/inline-reply-${width}.png`});
  await page.locator('#reply-discussion-form button[type=submit]').click();await page.waitForFunction(()=>window.__communityTest.comments.length===3);
  assert.equal(await page.locator('#discussion-form').count(),1);assert(await page.locator('#discussion-composer-home #discussion-form').isVisible());
  assert((await mainEditor.innerText()).includes('Ciornă independentă'),'Sending reply does not clear main draft');
  assert.equal(await page.locator('#post-root-one + .post-replies .reply').count(),1);
  assert.equal(await page.locator('#tab-discutii').textContent(),'Discuții (2)');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: independent main/reply editors, inline quote, cancel/switch/rerender preserve separate drafts, action icons, real reaction toggle/change/remove, keyboard/Escape, failure retention and mobile popover bounds.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
