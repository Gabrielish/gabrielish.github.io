const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  let hold=false,release;let gate=Promise.resolve();
  const date='2026-10-20T12:00:00Z';
  const rows={
   bg3ro_about_sections:[{id:'about',kind:'text',title:'Despre public QA',body:'Conținut public imediat.',is_visible:true,sort_order:1},{id:'private',kind:'text',title:'SECRET',body:'SECRET',is_visible:false}],
   bg3ro_project_updates:[{id:'update1',author_id:'member',author_name:'Nume vechi',title:'Actualizare publică QA',body:'Conținut actualizare QA.',published_at:date,is_visible:true},{id:'hidden',is_visible:false,body:'SECRET'}],
   bg3ro_releases:[{id:'release1',kind:'translation',version:'v1.2.3',title:'Versiune QA',description:'Descriere versiune QA.',file_name:'qa.rar',file_bytes:12345,download_url:'https://github.com/Gabrielish/bg3ro/raw/main/qa.rar',tags:'Windows',platform:'windows',published_at:date,is_visible:true,is_deleted:false}],
   'rpc/bg3ro_release_news':[],
   bg3ro_discussion_posts:[{id:'post1',author_id:'member',author_name:'Nume vechi',title:'Comentariu',body:'Discuție publică QA.',status:'approved',parent_id:null,created_at:date,is_guest:false},{id:'pending',status:'pending',body:'SECRET'}],
   bg3ro_bug_reports:[{id:'report1',title:'Raport QA',body:'Raport public QA cu detalii suficiente.',status:'new',author_name:'Membru QA',created_at:date,is_public:true},{id:'private',is_public:false,body:'SECRET'}],
   bg3ro_profiles:[{id:'member',display_name:'Nume actual QA',avatar_url:''}]
  };
  await p.route('https://baldursgate3.game/**',r=>r.abort());
  await p.route('https://esm.sh/**',r=>r.abort()); // Auth unavailable: public rendering must remain independent.
  await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'sb_publishable_qa',authEnabled:true};"}));
  await p.route('https://test.supabase.co/rest/v1/**',async r=>{
   const req=r.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,prefer','Access-Control-Expose-Headers':'content-range'};
   if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
   assert.equal(req.headers().authorization,undefined);
   if(hold)await gate;
   const u=new URL(req.url()),table=u.pathname.split('/rest/v1/')[1];
   const data=table==='bg3ro_discussion_posts'&&u.searchParams.has('parent_id')&&u.searchParams.get('parent_id')!=='is.null'?[]:rows[table]||[];
   await r.fulfill({contentType:'application/json',headers:{...headers,'content-range':'0-9/'+data.length},body:JSON.stringify(data)});
  });
  await p.goto('http://127.0.0.1:4173/#actualizari',{waitUntil:'domcontentloaded'});
  await p.getByRole('heading',{name:'Actualizare publică QA',exact:true}).waitFor();
  await p.waitForFunction(()=>document.querySelector('#discussion-list')?.textContent.includes('Discuție publică QA.')&&document.querySelector('#reports-list')?.textContent.includes('Raport public QA'));
  await p.waitForFunction(()=>document.querySelector('#despre')?.textContent.includes('Despre public QA'));
  assert.equal(await p.locator('[data-auth-gate]').count(),0);
  assert.equal(await p.locator('.about-loading').count(),0);
  const cached=await p.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('bg3ro-public-v1:')));
  assert(cached.length>=6);assert(!JSON.stringify(cached).includes('SECRET'),'Private, hidden and pending rows must never be cached');
  hold=true;gate=new Promise(resolve=>release=resolve);
  await p.reload({waitUntil:'domcontentloaded'});
  await p.getByRole('heading',{name:'Actualizare publică QA',exact:true}).waitFor({timeout:2000});
  assert.match(await p.locator('#discussion-list').textContent(),/Discuție publică QA/);
  assert.match(await p.locator('#reports-list').textContent(),/Raport public QA/);
  assert.deepEqual(errors,[]);assert.match(await p.locator('#descarcari').textContent(),/Versiune QA/);
  assert.equal(await p.locator('body').getByText(/Se încarcă (actualizările|discuțiile)/).count(),0);
  assert.equal(await p.locator('.about-section-tools').count(),0,'Public cache cannot grant administrator controls');
  rows.bg3ro_project_updates=[];rows.bg3ro_discussion_posts=[];rows.bg3ro_bug_reports=[];
  release();
  await p.waitForFunction(()=>!document.querySelector('#discussion-list').textContent.includes('Discuție publică QA'));
  await p.waitForFunction(()=>!document.querySelector('#updates-feed').textContent.includes('Actualizare publică QA'));
  await p.waitForFunction(()=>!document.querySelector('#reports-list').textContent.includes('Raport public QA'));
  assert.deepEqual(errors,[]);
  await p.close();
  console.log('PASS public first visit/warm reload with delayed network, background removal, private-row filtering and no cached admin access');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
