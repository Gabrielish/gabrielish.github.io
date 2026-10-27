const {clickNav}=require('./nav-action.cjs');
// Browser integration with a synthetic SDK. Real RLS is tested separately in portal-db.cjs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
function syntheticSDK(){
  // Component tests explicitly keep only necessary storage; consent is tested separately.
  window.BG3RO_COOKIES?.save(false);
  const state=window.__communityTest={user:null,comments:[],reports:[],updates:[],contacts:[],failInsert:false,status:{translation_percent:80,review_percent:20,testing_percent:20,review_state:'Actul I verificat',testing_state:'Actul II urmează'}};
  const moderator=()=>state.user?.id==='owner';
  state.reportReplies=window.__qaReportReplies||[];
  state.about=window.__qaAbout||[
   {id:'progress',kind:'progress',title:'Progresul traducerii',body:'',legacy_note:'',is_visible:true,sort_order:10,translation_percent:80,review_percent:20,testing_percent:20},
   {id:'about',kind:'text',title:'Despre proiect',body:'Un proiect de traducere testat în context.',legacy_note:'Notă de test păstrată.',is_visible:true,sort_order:20},
   {id:'work',kind:'text',title:'La ce lucrez acum',body:'Revizia interfeței și verificarea traducerii.',legacy_note:'',is_visible:true,sort_order:30},
   {id:'modules',kind:'text',title:'Moduri pentru particularitățile limbii române',body:null,legacy_note:'',is_visible:true,sort_order:40},
   {id:'gallery',kind:'gallery',title:'Galerie',body:'',legacy_note:'',is_visible:true,sort_order:50}
  ];
  let authCallback=()=>{};
  const client={
    auth:{getSession:async()=>({data:{session:state.user?{user:state.user}:null},error:null}),onAuthStateChange:cb=>{authCallback=cb;return{data:{subscription:{unsubscribe(){}}}}},
      signInWithOAuth:async(options)=>{state.oauth=options;if(state.failOAuth)return{error:{message:'Network error'}};state.user={id:window.__qaOwner?'owner':'alice',app_metadata:{provider:options.provider||'discord'},user_metadata:{full_name:'Jucător Discord',moderator:true}};const session={user:state.user};setTimeout(()=>authCallback('SIGNED_IN',session),0);return{data:{},error:null}},
      signInAnonymously:async()=>{state.guestCalls=(state.guestCalls||0)+1;state.user={id:'guest',is_anonymous:true,user_metadata:{}};const session={user:state.user};setTimeout(()=>authCallback('SIGNED_IN',session),0);return{data:{session},error:null}},
      exchangeCodeForSession:async code=>{state.exchangeCode=code;if(code==='expired')return{data:{session:null},error:{message:'expired'}};state.user={id:'alice',user_metadata:{full_name:'Jucător Discord',moderator:true}};return{data:{session:{user:state.user}},error:null}},
      signOut:async()=>{state.user=null;authCallback('SIGNED_OUT',null);return{error:null}}},
    rpc:async(name,args)=>{if(name==='bg3ro_release_news')return{data:JSON.parse(JSON.stringify((state.releases||[]).filter(row=>row.kind==='translation'&&!row.is_deleted&&(moderator()||row.news_is_visible!==false)))),error:null};if(name==='bg3ro_reorder_about_sections'){
      const current=[...state.about].sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id)).map(row=>row.id);
      if(!moderator()||state.failOrder||JSON.stringify(current)!==JSON.stringify(args.p_expected)||new Set(args.p_ids).size!==current.length||args.p_ids.some(id=>!current.includes(id)))return{data:null,error:{message:'Cannot reorder'}};
      args.p_ids.forEach((id,index)=>state.about.find(row=>row.id===id).sort_order=(index+1)*10);return{data:true,error:null};
    }return{data:moderator(),error:null};},
    from(table){
      if(table==='bg3ro_releases'&&state.releases)for(const row of state.releases){row.is_visible??=true;row.is_deleted??=false;row.platform??=/windows/i.test(row.tags||'')&&!/mac\s?os/i.test(row.tags||'')?'windows':/mac\s?os/i.test(row.tags||'')&&!/windows/i.test(row.tags||'')?'macos':'all';}
      const query={operation:'select',filters:[],single:false,payload:null,orders:[],bounds:null,
        select(){return this},eq(key,value){this.filters.push([key,value]);return this},is(key,value){this.filters.push([key,value]);return this},in(key,value){this.filters.push([key,value]);return this},order(key,options){this.orders.push([key,options?.ascending!==false]);return this},limit(){return this},range(a,b){this.bounds=[a,b];return this},maybeSingle(){this.single=true;return this},
        insert(payload){this.operation='insert';this.payload=payload;return this},update(payload){this.operation='update';this.payload=payload;return this},delete(){this.operation='delete';return this},
        then(resolve,reject){return Promise.resolve().then(()=>{
          const name=table.replace('bg3ro_',''),key={discussion_posts:'comments',bug_reports:'reports',project_updates:'updates',contact_messages:'contacts'}[name];
          if(name==='report_replies'){
            if(state.failReplies)return{data:null,error:{message:'Network error'}};
            const matches=row=>this.filters.every(([k,v])=>row[k]===v),allowed=row=>state.reports.some(r=>r.id===row.report_id&&(r.is_public||r.author_id===state.user?.id||moderator()));
            let data=state.reportReplies.filter(matches).filter(allowed);
            if(this.operation==='insert'){
              if(state.failInsert||!state.user||this.payload.author_id!==state.user.id||!allowed(this.payload))return{data:null,error:{message:'Denied'}};
              const guest=!!state.user.is_anonymous,row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...this.payload,is_guest:guest,author_is_admin:moderator()&&!guest,author_profile_id:guest?null:state.user.id,author_avatar_url:guest?null:'https://cdn.discordapp.com/embed/avatars/0.png',author_name:guest?this.payload.author_name:moderator()?'Administrator QA':'Jucător Discord'};
              state.reportReplies.push(row);data=[row];
            }
            if(this.operation==='update'||this.operation==='delete'){
              data=data.filter(row=>moderator()||row.author_id===state.user?.id);
              if(this.operation==='update')data.forEach(row=>Object.assign(row,this.payload));else state.reportReplies=state.reportReplies.filter(row=>!data.includes(row));
            }
            data.sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));return{data:JSON.parse(JSON.stringify(data)),count:data.length,error:null};
          }
          if(name==='about_sections'){
            if(state.failAbout)return{data:null,error:{message:'Network error'}};
            const matches=row=>this.filters.every(([k,v])=>row[k]===v);let data=state.about.filter(matches).filter(row=>moderator()||row.is_visible);
            if(this.operation!=='select'&&!moderator())return{data:null,error:{message:'Denied'}};
            if(this.operation==='insert'){if(state.failInsert)return{data:null,error:{message:'Network error'}};const row={id:crypto.randomUUID(),kind:'text',is_visible:true,legacy_note:'',...this.payload};state.about.push(row);data=[row];}
            if(this.operation==='update')data.forEach(row=>Object.assign(row,this.payload));
            if(this.operation==='delete')state.about=state.about.filter(row=>!data.includes(row));
            data=[...data].sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id));return{data:this.single?data[0]||null:JSON.parse(JSON.stringify(data)),error:null};
          }
          if(name==='project_status'){
            if(this.operation==='update')Object.assign(state.status,this.payload);
            return{data:{...state.status},error:null};
          }
          if(this.operation==='insert'){
            if(state.failInsert)return{data:null,error:{message:'Network error'}};
            const row={id:`row-${Date.now()}-${Math.random()}`,created_at:new Date().toISOString(),published_at:new Date().toISOString(),status:key==='comments'?'approved':'new',moderator_reply:'',...this.payload,is_guest:!!state.user?.is_anonymous};
            state[key].unshift(row);return{data:null,error:null};
          }
          const matches=row=>this.filters.every(([k,v])=>Array.isArray(v)?v.includes(row[k]):(row[k]??null)===v);
          if(this.operation==='update'){state[key].filter(matches).forEach(row=>Object.assign(row,this.payload));return{data:null,error:null}}
          if(this.operation==='delete'){state[key]=state[key].filter(row=>!matches(row));return{data:null,error:null}}
          let data=state[key].filter(matches).filter(row=>moderator()||key==='updates'||(key==='reports'&&row.is_public)||(key==='comments'&&row.status==='approved')||row.author_id===state.user?.id);
          for(const [key,asc] of [...this.orders].reverse())data.sort((a,b)=>String(a[key]).localeCompare(String(b[key]))*(asc?1:-1));
          const count=data.length;if(this.bounds)data=data.slice(this.bounds[0],this.bounds[1]+1);
          return{data:JSON.parse(JSON.stringify(data)),count,error:null};
        }).then(resolve,reject)}
      };return query;
    }
  };return client;
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const owner of [false,true]){
      const p=await browser.newPage({viewport:{width:owner?1440:390,height:950},reducedMotion:'reduce'});
      await p.route('https://baldursgate3.game/**',r=>r.abort());
      await p.addInitScript(isOwner=>{window.__qaOwner=isOwner;},owner);
      const errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test-project.supabase.co',supabasePublishableKey:'test-public-key'};"}));
      await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${syntheticSDK.toString()})();`}));
      await p.goto(process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');
      assert.equal(await p.locator('#tab-discutii').textContent(),'Discuții');
      assert.equal(await p.locator('#tab-erori').textContent(),'Raportare erori');
      assert.equal(await p.locator('#discussion-count').count(),0);
      assert.equal(await p.locator('#discussion-list .empty-state h3').textContent(),'Deschide conversația');
      assert.equal(await p.locator('#reports-list .report-empty p').textContent(),'Nu a fost raportată încă nicio eroare.');
      assert.equal(await p.locator('.report-empty').evaluate(el=>getComputedStyle(el).textAlign),'center');
      for(const selector of ['#discussion-list .empty-state']){
        assert.deepEqual(await p.locator(selector).evaluate(el=>{const s=getComputedStyle(el);return [s.textAlign,s.padding]}),['center','30px 0px']);
        assert.equal(await p.locator(selector+' > p.small').count(),1);
      }
      await clickNav(p,'.topbar [data-auth-open]');await p.locator('#auth-dialog a[data-go-tab="confidentialitate"]').click();
      assert(!await p.locator('#auth-dialog').isVisible());assert(await p.locator('#confidentialitate.information-panel').isVisible());assert.equal(await p.locator('#date-personale').count(),0);await p.locator('#tab-despre').click();
      await clickNav(p,'.topbar [data-auth-open]');await p.locator('#discord-login').click();await p.waitForSelector('#auth-dialog',{state:'hidden'});
      assert.equal(await p.evaluate(()=>window.__communityTest.oauth.provider),'discord');
      assert.equal(await p.locator('#discussion-name').inputValue(),'Jucător Discord');
      assert.equal(await p.locator('#discussion-name').evaluate(el=>el.readOnly),true,'Discord name cannot be edited');
      await p.locator('#tab-discutii').click();
      await p.locator('#discussion-name').evaluate(el=>el.value='Nume modificat manual');
      assert.equal(await p.locator('#discussion-title').getAttribute('type'),'hidden');
      await p.locator('#discussion-editor .discussion-prosemirror').fill('<img src=x onerror="window.injected=true"> Text de test.');
      await p.locator('#discussion-form button[type=submit]').click();await p.waitForSelector('#discussion-list .post');
      assert.equal(await p.locator('#discussion-list .post-body img').count(),0);assert.equal(await p.evaluate(()=>window.injected),undefined);
      assert.equal(await p.evaluate(()=>window.__communityTest.comments.length),1);
      assert.equal(await p.locator('#tab-discutii').textContent(),'Discuții (1)');
      assert.equal(await p.evaluate(()=>window.__communityTest.comments[0].author_name),'Jucător Discord','Submission uses the account name, not the form value');
      assert.equal(await p.evaluate(()=>window.__communityTest.comments[0].status),'approved');
      assert.equal(await p.locator('#discussion-form .form-status').textContent(),'');assert(!(await p.locator('#discussion-form .form-status').isVisible()));
      assert.equal(await p.locator('#discussion-form button[type=submit]').textContent(),'Trimite');
      assert((await p.locator('#report-form button[type=submit]').textContent()).includes('Raportează o eroare'));
      await p.locator('#tab-erori').click();await p.locator('#report-editor .discussion-prosemirror').fill('Un context de test care descrie suficient de clar eroarea.');
      await p.evaluate(()=>window.__communityTest.failInsert=true);await p.locator('#report-form button[type=submit]').click();await p.waitForSelector('#report-form .form-status.error');assert.equal(await p.evaluate(()=>window.__communityTest.reports.length),0);
      assert((await p.locator('#report-editor .discussion-prosemirror').innerText()).includes('Un context de test'));
      await p.evaluate(()=>window.__communityTest.failInsert=false);await p.locator('#report-form button[type=submit]').click();await p.waitForSelector('.report-item');
      assert.equal(await p.locator('#report-form .form-status').textContent(),'');assert(!(await p.locator('#report-form .form-status').isVisible()));
      assert.equal(await p.locator('.report-item').count(),1);assert.equal(await p.evaluate(()=>window.__communityTest.reports.length),1);
      assert.equal(await p.locator('#tab-erori').textContent(),'Raportare erori (1)');
      if(owner){
        await p.locator('.report-toolbar').getByRole('button',{name:'Stare: Nou',exact:true}).click();await p.getByRole('menuitemradio',{name:'Rezolvat',exact:true}).click();await p.waitForFunction(()=>window.__communityTest.reports[0].status==='resolved');
        await p.locator('#tab-despre').click();await p.getByRole('button',{name:'Editează Progresul traducerii',exact:true}).click();
        const progress=p.locator('[data-about-section=progress] form');await progress.locator('[name=translation_percent]').fill('82');await progress.locator('[name=review_percent]').fill('25');await progress.locator('[name=testing_percent]').fill('30');await progress.getByRole('button',{name:'Salvează',exact:true}).click();await progress.waitFor({state:'detached'});
        await p.keyboard.press('Escape');assert.equal(await p.locator('#translation-percent').textContent(),'82%');assert.equal(await p.locator('#review-percent').textContent(),'25%');assert.equal(await p.locator('#testing-percent').textContent(),'30%');
        await p.locator('#tab-actualizari').click();await p.getByRole('button',{name:'Publică o actualizare',exact:true}).click();await p.locator('#update-title').fill('Actualizare de test');await p.locator('#update-form .discussion-prosemirror').fill('O actualizare sintetică pentru testarea interfeței.');await p.locator('#update-form button[type=submit]').click();await p.waitForFunction(()=>document.querySelector('#updates-feed').textContent.includes('Actualizare de test'));await p.keyboard.press('Escape');
      }else assert.equal(await p.locator('#admin-tools:visible').count(),0);
      await clickNav(p,'#sign-out');await p.waitForSelector('#sign-out',{state:'hidden'});await p.waitForFunction(()=>window.__communityTest.user?.is_anonymous);await p.locator('#tab-erori').click();assert.equal(await p.locator('#report-form:visible').count(),1);assert.equal(await p.locator('#my-reports:visible').count(),1);assert.equal(await p.locator('.report-item').count(),1);
      assert.deepEqual(errors,[]);await p.close();
    }
    for(const outcome of ['success','expired','cancelled']){
      const p=await browser.newPage({viewport:{width:390,height:950}});
      await p.route('https://baldursgate3.game/**',r=>r.abort());
      await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test-project.supabase.co',supabasePublishableKey:'test-public-key',authEnabled:true,authRedirectUrl:'https://gabrielish.github.io/'};"}));
      await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=(_url,_key,options)=>{window.__authOptions=options;return (${syntheticSDK.toString()})();};`}));
      await p.addInitScript(()=>sessionStorage.setItem('bg3ro-return-tab','erori'));
      const url=new URL(process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/');
      url.search=outcome==='cancelled'?'?error=access_denied&error_description=untrusted-message':`?code=${outcome==='success'?'test-code':'expired'}`;
      await p.goto(url.href,{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');
      assert.equal(new URL(p.url()).search,'');assert.equal(new URL(p.url()).hash,'#erori');
      assert.equal(await p.evaluate(()=>window.__authOptions.auth.flowType),'pkce');
      assert(await p.evaluate(()=>window.__authOptions.auth.storage===window.BG3RO_AUTH_STORAGE));
      assert.equal(await p.locator('#admin-tools:visible').count(),0,'User metadata cannot grant moderator access');
      if(outcome==='success'){assert(await p.locator('#report-form').isVisible());assert.equal(await p.evaluate(()=>window.__communityTest.exchangeCode),'test-code');}
      else {assert(await p.locator('#auth-dialog').isVisible());assert(await p.locator('#discord-login-form .form-status.error').isVisible());assert.equal(await p.locator('#report-form:visible').count(),1);assert(!(await p.locator('#auth-dialog').textContent()).includes('untrusted-message'));}
      await p.close();
    }
    console.log('PASS: synthetic Discord OAuth, PKCE callback success/expiry/cancel, query cleanup and tab restore, no metadata-based privileges, login/logout, posts, reports, XSS and moderation controls. Real Discord consent still requires owner verification.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
