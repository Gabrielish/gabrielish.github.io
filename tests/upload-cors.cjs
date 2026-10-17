// Read-only live regression: use an invalid diagnostic JWT, never the owner's session.
// Do NOT add page.route(): request interception can bypass Chromium's real CORS check.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  const corsErrors=[];
  page.on('console',message=>{if(/blocked by CORS policy/.test(message.text()))corsErrors.push(message.text());});
  await page.goto('https://gabrielish.github.io/',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.118.0');
   const client=createClient('https://gatkiwcyjgbgjwfgvplm.supabase.co','sb_publishable_8wgqYScl0lmXs3-x0feaIw_4z7kr4bd',{auth:{persistSession:false}});
   const result=await client.functions.invoke('bg3ro-upload',{
    body:new File([new Uint8Array([80,75,3,4])],'cors-diagnostic.zip'),
    headers:{Authorization:'Bearer invalid-diagnostic-token','Content-Type':'application/octet-stream','x-file-name':'cors-diagnostic.zip'}
   });
   let body=null;try{body=await result.error.context.json();}catch(_){}
   return{name:result.error?.name,status:result.error?.context?.status,body};
  });
  assert.deepEqual(corsErrors,[],'The real browser must not block the SDK upload preflight');
  assert.equal(result.name,'FunctionsHttpError','Expected a readable server response, not FunctionsFetchError');
  assert.equal(result.status,401,'Invalid JWT must still be rejected');
  assert.equal(result.body?.message,'Sesiunea a expirat.');
  console.log('PASS: live browser CORS preflight and SDK POST reach upload function; JSON errors readable, invalid JWT denied; no file written.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
