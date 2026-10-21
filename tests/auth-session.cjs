const {clickNav}=require('./nav-action.cjs');
// Synthetic session values only. No real user tokens or consent are used here.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8');
const sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
const mock=`export const createClient=(_url,_key,options)=>{
 const client=(${sdk})(),storage=options.auth.storage,key=options.auth.storageKey;
 client.auth.getSession=async()=>{const saved=storage.getItem(key);window.__communityTest.user=saved?JSON.parse(saved).user:null;return{data:{session:saved?JSON.parse(saved):null},error:null};};
 const oauth=client.auth.signInWithOAuth,logout=client.auth.signOut,guest=client.auth.signInAnonymously;
 client.auth.signInAnonymously=async()=>{const result=await guest();storage.setItem(key,JSON.stringify(result.data.session));return result;};
 client.auth.signInWithOAuth=async args=>{const result=await oauth(args);storage.setItem(key,JSON.stringify({user:window.__communityTest.user,access_token:'synthetic-access',refresh_token:'synthetic-refresh',provider_token:'unused-provider-token',provider_refresh_token:'unused-provider-refresh'}));return result;};
 client.auth.signOut=async()=>{storage.removeItem(key);return logout();};return client;
};`;
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await b.newContext({reducedMotion:'reduce'});
 await context.route('https://baldursgate3.game/**',r=>r.abort());
 await context.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test-public'};"}));
 await context.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:mock}));
 const open=async()=>{const p=await context.newPage();await p.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');return p;};
 let p=await open();await clickNav(p,'.topbar [data-auth-open]');await p.locator('#auth-consent').check();await p.locator('#discord-login').click();await p.waitForFunction(()=>!document.querySelector('#sign-out').hidden);
 assert.equal(await p.evaluate(()=>window.__communityTest.oauth.options.queryParams.prompt),'consent');
 assert(await p.evaluate(()=>{const stored=JSON.parse(localStorage.getItem('bg3ro-auth'));return stored.user.id==='alice'&&!stored.provider_token&&!stored.provider_refresh_token&&!sessionStorage.getItem('bg3ro-auth');}));
 await p.close();p=await open();assert(await p.locator('#sign-out').evaluate(el=>!el.hidden),'Reopening a tab restores session without OAuth');assert.equal(await p.evaluate(()=>window.__communityTest.oauth),undefined);
 await clickNav(p,'#sign-out');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('bg3ro-auth'))?.user?.is_anonymous);assert(await p.evaluate(()=>!sessionStorage.getItem('bg3ro-auth')));
 await clickNav(p,'.topbar [data-auth-open]');await p.locator('#auth-consent').check();await p.locator('#discord-login').click();await p.waitForSelector('#auth-dialog',{state:'hidden'});
 assert.equal(await p.evaluate(()=>window.__communityTest.oauth.options.queryParams.prompt),'none');
 await clickNav(p,'#sign-out');await p.close();
 p=await context.newPage();await p.goto('http://127.0.0.1:4173/?error=access_denied&error_description=ignored',{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');
 await p.locator('#auth-consent').check();await p.locator('#discord-login').click();await p.waitForSelector('#auth-dialog',{state:'hidden'});assert.equal(await p.evaluate(()=>window.__communityTest.oauth.options.queryParams.prompt),'consent','Failed silent login falls back to approval');
 await clickNav(p,'#sign-out');
 await p.evaluate(()=>{localStorage.removeItem('bg3ro-auth');sessionStorage.setItem('bg3ro-auth',JSON.stringify({user:{id:'legacy',user_metadata:{}},provider_token:'old-provider'}));sessionStorage.setItem('bg3ro-auth-code-verifier','synthetic-verifier');});
 await p.reload({waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');assert(await p.locator('#sign-out').evaluate(el=>!el.hidden));
 assert(await p.evaluate(()=>JSON.parse(localStorage.getItem('bg3ro-auth')).user.id==='legacy'&&!sessionStorage.getItem('bg3ro-auth')&&!localStorage.getItem('bg3ro-auth-code-verifier')&&sessionStorage.getItem('bg3ro-auth-code-verifier')==='synthetic-verifier'));
 await p.close();await context.close();
 console.log('PASS: persistent session restored across tabs, legacy migration, no Discord provider tokens persisted, tab-local PKCE, clean logout, repeat prompt=none and consent fallback. Synthetic SDK.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
