const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/';
function fakeSDK(){
 const state=window.__contactQA={user:window.__qaContactOwner?{id:'owner'}:null,rows:window.__qaContactOwner?[{id:'one',name:'Vizitator',email:'qa@example.invalid',subject:'O întrebare privată',body:'<img src=x onerror=alert(1)> Un mesaj privat.',created_at:'2026-10-18T10:00:00Z',is_read:false}]:[],fail:false,guestCalls:0};
 return {auth:{getSession:async()=>({data:{session:state.user?{user:state.user}:null}}),onAuthStateChange:()=>({data:{}}),signInAnonymously:async()=>{state.guestCalls++;state.user={id:'guest',is_anonymous:true};return{data:{session:{user:state.user}}};}},rpc:async()=>({data:state.user?.id==='owner'}),from(){const q={op:'select',payload:null,filter:null,bounds:[0,19],select(){return this;},order(){return this;},range(a,b){this.bounds=[a,b];return this;},eq(k,v){this.filter=[k,v];return this;},insert(v){this.op='insert';this.payload=v;return this;},update(v){this.op='update';this.payload=v;return this;},delete(){this.op='delete';return this;},then(resolve,reject){return Promise.resolve().then(()=>{
 if(state.fail)return{error:{message:'Network failed'}};
 if(this.op==='insert'){state.rows.push({id:'new',...this.payload});return{data:null,error:null};}
 const found=state.rows.filter(row=>!this.filter||row[this.filter[0]]===this.filter[1]);
 if(this.op==='update')found.forEach(row=>Object.assign(row,this.payload));
 if(this.op==='delete')state.rows=state.rows.filter(row=>!found.includes(row));
 return{data:this.op==='select'?state.rows.slice(this.bounds[0],this.bounds[1]+1):found,count:state.rows.length,error:null};
 }).then(resolve,reject);}};return q;}};
}
(async()=>{
 fs.mkdirSync('.qa',{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 for(const width of [320,390,768,1440]){
  const p=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'export const createClient=()=>('+fakeSDK.toString()+')();'}));
  for(const slug of ['contact','intrebari-frecvente','confidentialitate','termeni']){
   const response=await p.goto(base+slug+'/',{waitUntil:'networkidle'});assert.equal(response.status(),200);assert.equal(await p.locator('h1').count(),1);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+width+' '+slug);
   assert.equal(await p.locator('nav[aria-labelledby="footer-information"] a').count(),4);
   assert.equal(await p.locator('.footer [href="https://gabrielish.github.io/Polyhedron/"]').count(),1);
   if(slug==='intrebari-frecvente'){await p.locator('summary').first().click();assert(await p.locator('details').first().evaluate(e=>e.open));await p.locator('summary').first().focus();await p.keyboard.press('Enter');assert.equal(await p.locator('details').first().evaluate(e=>e.open),false);}
   if([390,1440].includes(width))await p.screenshot({path:'.qa/info-'+slug+'-'+width+'.png',fullPage:true});
  }
  await p.goto(base+'contact/',{waitUntil:'networkidle'});await p.waitForFunction(()=>!document.querySelector('#contact-form button').disabled);
  assert.equal(await p.evaluate(()=>__contactQA.guestCalls),0,'No account on visit');
  assert.equal(await p.locator('#contact-inbox:visible').count(),0);
  await p.locator('#contact-name').fill('Vizitator');await p.locator('#contact-email').fill('qa@example.invalid');await p.locator('#contact-subject').fill('Întrebare despre traducere');await p.locator('#contact-body').fill('Un mesaj privat suficient de lung.');
  await p.locator('#contact-form button').click();assert.equal(await p.evaluate(()=>__contactQA.rows.length),0,'Consent required');
  await p.locator('[name=privacy]').check();await p.locator('#contact-form button').click();await p.waitForFunction(()=>document.querySelector('#contact-form .form-status').textContent.includes('a fost primit'));
  assert.equal(await p.evaluate(()=>__contactQA.guestCalls),1);assert.equal(await p.evaluate(()=>__contactQA.rows[0].email),'qa@example.invalid');
  await p.evaluate(()=>__contactQA.fail=true);await p.locator('#contact-name').fill('Vizitator');await p.locator('#contact-email').fill('qa@example.invalid');await p.locator('#contact-subject').fill('Alt mesaj');await p.locator('#contact-body').fill('Un mesaj privat suficient de lung.');await p.locator('[name=privacy]').check();await p.locator('#contact-form button').click();await p.waitForFunction(()=>document.querySelector('#contact-form .form-status').textContent.includes('nu a fost trimis'));assert.equal(await p.locator('#contact-body').inputValue(),'Un mesaj privat suficient de lung.');
  assert.deepEqual(errors,[]);await p.close();
 }
 const p=await browser.newPage();await p.addInitScript(()=>window.__qaContactOwner=true);
 await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'export const createClient=()=>('+fakeSDK.toString()+')();'}));
 await p.goto(base+'contact/',{waitUntil:'networkidle'});await p.waitForSelector('#contact-inbox:visible');await p.waitForSelector('.contact-message');
 assert.equal(await p.locator('.contact-message img').count(),0,'Message rendered as text, not HTML');
 await p.getByRole('button',{name:'Marchează citit',exact:true}).click();await p.waitForFunction(()=>__contactQA.rows[0].is_read===true);
 p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Șterge',exact:true}).click();await p.waitForFunction(()=>__contactQA.rows.length===0);await p.close();
 const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});await nojs.goto(base+'contact/');assert(await nojs.locator('noscript a[href^="mailto:"]').isVisible());await nojs.close();
 console.log('PASS: four static pages, footer links, FAQ keyboard, mobile 320–1440, private guest contact, validation, failures retain text, owner inbox read/delete, XSS-safe text, no-JS contact.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
