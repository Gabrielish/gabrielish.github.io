// Real SDK + hosted Supabase authorize endpoint. Stops BEFORE Discord consent.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 let authorizeURL;
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/auth/v1/authorize')authorizeURL=url;});
 await page.route('https://baldursgate3.game/**',r=>r.abort());
 await page.route('https://discord.com/**',r=>r.fulfill({contentType:'text/html',body:'<title>OAuth preflight stopped before consent</title>'}));
 await page.goto(process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});await page.waitForSelector('html.portal-ready');
 await page.locator('.topbar [data-auth-open]').click();
 assert(await page.locator('#discord-login').isEnabled());assert(!await page.locator('#auth-unavailable').isVisible());
 await page.screenshot({path:'.qa/discord-login-mobile.png'});
 await page.locator('#auth-consent').check();await page.locator('#discord-login').click();
 await page.waitForURL(url=>url.hostname==='discord.com');const target=new URL(page.url());
 assert.equal(authorizeURL.searchParams.get('code_challenge_method'),'s256');
 assert(authorizeURL.searchParams.get('code_challenge').length>=43);
 assert.equal(authorizeURL.searchParams.get('redirect_to'),'https://gabrielish.github.io/');
 assert.equal(target.searchParams.get('client_id'),'1190788174314754161');
 assert.equal(target.searchParams.get('redirect_uri'),'https://gatkiwcyjgbgjwfgvplm.supabase.co/auth/v1/callback');
 assert(target.searchParams.get('scope').includes('identify'));
 console.log('PASS: real SDK stores PKCE verifier, hosted Supabase sends Login to correct Discord application/callback; stopped before user consent.');
}finally{await browser.close()}})().catch(e=>{console.error(e.name+': '+e.message.split('\n')[0]);process.exitCode=1});
