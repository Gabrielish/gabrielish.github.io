const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
const moduleSource=`export const createClient=()=>{const client=(${sdk})(),from=client.from.bind(client),base=client.rpc;const s=window.__communityTest;s.polls=[];s.votes=[];
 client.from=table=>table==='bg3ro_discussion_polls'?{select(){return this},in:async(k,ids)=>({data:s.polls.filter(p=>ids.includes(p.post_id)),error:null})}:from(table);
 client.rpc=async(name,args)=>{
 if(name==='bg3ro_publish_poll'){if(s.failInsert)return{error:{message:'Network error'}};await from('bg3ro_discussion_posts').insert({author_id:s.user.id,author_name:args.p_name,title:'Comentariu',body:args.p_body,parent_id:null});s.polls.push({post_id:s.comments[0].id,question:args.p_question,options:args.p_options,multiple:args.p_multiple});return{data:s.comments[0].id,error:null};}
 if(name==='bg3ro_poll_summary')return{data:s.polls.filter(p=>args.p_post_ids.includes(p.post_id)).map(p=>{const votes=s.votes.filter(v=>v.post_id===p.post_id);return{post_id:p.post_id,counts:p.options.map((o,i)=>votes.filter(v=>v.choices.includes(i)).length),choices:votes.find(v=>v.user_id===s.user?.id)?.choices||[],voters:votes.length}}),error:null};
 if(name==='bg3ro_vote_poll'){if(s.failVote)return{error:{message:'Network error'}};s.votes=s.votes.filter(v=>v.post_id!==args.p_post_id||v.user_id!==s.user.id);if(args.p_choices.length)s.votes.push({post_id:args.p_post_id,user_id:s.user.id,choices:args.p_choices});return{error:null};}
 return base(name,args);};return client;};`;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>window.__qaOwner=true);
 await page.route('https://baldursgate3.game/**',r=>r.abort());
 await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'};"}));
 await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:moduleSource}));
 await page.goto('http://127.0.0.1:4173/#discutii',{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
 assert.equal(await page.locator('#discussion-form button[type=submit]').textContent(),'Trimite');
 assert.equal(await page.locator('#reply-discussion-form .discussion-add-poll').count(),0,'Poll composer belongs only to root discussion');
 await page.locator('#discussion-name').fill('Vizitator sondaj');await page.getByRole('button',{name:'Adaugă un sondaj',exact:true}).click();
 assert(await page.locator('#discussion-poll-composer').isVisible());
 const backgrounds=await page.evaluate(()=>['.discussion-compose','#discussion-poll-composer'].map(selector=>getComputedStyle(document.querySelector(selector)).backgroundColor));
 assert.equal(backgrounds[0],backgrounds[1],'Poll composer uses the same theme background as its card');
 await page.locator('#poll-question').fill('Ce ai vrea să fie revizuit mai întâi?');
 await page.getByRole('textbox',{name:'Opțiunea 1',exact:true}).fill('Dialogurile');await page.getByRole('textbox',{name:'Opțiunea 2',exact:true}).fill('Interfața');
 await page.getByRole('button',{name:'+ Adaugă o opțiune',exact:true}).click();await page.getByRole('textbox',{name:'Opțiunea 3',exact:true}).fill('Obiectele');await page.locator('#poll-multiple').check();
 await page.addStyleTag({content:'.topbar{visibility:hidden!important}'});
 await page.locator('.discussion-compose').screenshot({path:`.qa/poll-composer-${width}.png`});
 await page.evaluate(()=>window.__communityTest.failInsert=true);await page.locator('#discussion-form button[type=submit]').click();await page.waitForSelector('#discussion-form .form-status.error');
 assert.equal(await page.locator('#poll-question').inputValue(),'Ce ai vrea să fie revizuit mai întâi?');assert.equal(await page.locator('.discussion-poll').count(),0);
 await page.evaluate(()=>window.__communityTest.failInsert=false);await page.locator('#discussion-form button[type=submit]').click();await page.waitForSelector('.discussion-poll');
 assert.equal(await page.locator('#discussion-poll-composer').isVisible(),false);assert.equal(await page.locator('.discussion-poll input[type=checkbox]').count(),3);
 await page.locator('.discussion-poll input').nth(0).check();await page.locator('.discussion-poll input').nth(2).check();await page.locator('.discussion-poll button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('.poll-meta').textContent.includes('1 participant'));
 assert.equal(await page.locator('.poll-option-total').nth(0).textContent(),'1 · 100%');assert.equal(await page.locator('.poll-option-total').nth(1).textContent(),'0 · 0%');
 assert.equal(await page.evaluate(()=>window.__communityTest.votes.length),1,'One account counts as one participant');
 await page.evaluate(()=>window.__communityTest.failVote=true);await page.locator('.discussion-poll input').nth(1).check();await page.locator('.discussion-poll button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('.poll-status').textContent.includes('nu a fost salvat'));
 assert.equal(await page.locator('.discussion-poll input').nth(1).isChecked(),false,'Failed change restores confirmed choices');
 await page.evaluate(()=>window.__communityTest.failVote=false);await page.locator('.poll-remove').click();await page.waitForFunction(()=>document.querySelector('.poll-meta').textContent.includes('0 participanți'));
 await page.locator('.discussion-poll').screenshot({path:`.qa/poll-results-${width}.png`});
 await page.locator('.topbar [data-auth-open]').evaluate(button=>button.click());await page.locator('#auth-consent').check();await page.locator('#discord-login').click();await page.waitForFunction(()=>!document.querySelector('#sign-out').hidden);
 const reject=page.locator('.post-actions').getByRole('button',{name:'Nu publica',exact:true});assert.equal(await reject.locator('svg').count(),1);await reject.click();
 const approve=page.locator('.post-actions').getByRole('button',{name:'Aprobă',exact:true});await approve.waitFor();assert.equal(await approve.locator('svg').count(),1);await approve.click();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
}console.log('PASS: poll composer, failed/successful atomic publishing, multiple vote/change/remove, real fixture counts, error retention, moderation icons, mobile layout.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
