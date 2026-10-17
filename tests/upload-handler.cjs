const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const {createUploadHandler}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('supabase/functions/bg3ro-upload/handler.js','utf8')).toString('base64'));
 const owner='73ce4438-cb0e-4556-8f47-33fb03532ac1',commit='a'.repeat(40),sha='b'.repeat(40);
 let user=owner,moderator=true,token='server-secret-test',existing=false,puts=[],calls=[],githubReadStatus=0,githubWriteStatus=0;
 const handler=createUploadHandler({env:name=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-key',GITHUB_UPLOAD_TOKEN:token})[name],fetch:async(url,options)=>{
  calls.push(url);
  if(url.endsWith('/auth/v1/user'))return Response.json({id:user});
  if(url.endsWith('/rpc/bg3ro_is_moderator'))return Response.json(moderator);
  if(options.method==='PUT'){puts.push(JSON.parse(options.body));assert.equal(options.headers.Authorization,'Bearer server-secret-test');if(githubWriteStatus)return Response.json({message:'Resource not accessible by personal access token server-secret-test'}, {status:githubWriteStatus});return Response.json({commit:{sha:commit}});}
  if(githubReadStatus)return Response.json({message:'Bad credentials server-secret-test'},{status:githubReadStatus});
  return existing?Response.json({type:'file',sha}):new Response(null,{status:404});
 }});
 const request=(headers={},body=new Uint8Array([80,75,3,4,0,0]))=>new Request('https://test.supabase.co/functions/v1/bg3ro-upload',{method:'POST',headers:{origin:'https://gabrielish.github.io',authorization:'Bearer signed-user-token','x-file-name':'translation.zip',...headers},body});
 const preflight=await handler(new Request('https://test/upload',{method:'OPTIONS',headers:{origin:'https://gabrielish.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type,x-client-info,x-file-name'}}));
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://gabrielish.github.io');
 const allowed=new Set(preflight.headers.get('Access-Control-Allow-Headers').split(',').map(s=>s.trim().toLowerCase()));
 for(const header of ['authorization','apikey','content-type','x-client-info','x-file-name','x-retry-count','traceparent','tracestate','baggage'])assert(allowed.has(header),`Missing CORS header: ${header}`);
 assert.equal(calls.length,0,'Preflight must not authenticate or contact GitHub');
 const blocked=await handler(new Request('https://test/upload',{method:'OPTIONS',headers:{origin:'https://evil.example'}}));
 assert.equal(blocked.status,403);assert.equal(blocked.headers.get('Access-Control-Allow-Origin'),null);
 assert.equal((await handler(new Request('https://test/upload',{method:'POST'}))).status,401);
 assert.equal((await handler(request({origin:'https://evil.example'}))).status,403);
 user='attacker';assert.equal((await handler(request())).status,403);user=owner;
 moderator=false;assert.equal((await handler(request())).status,403);moderator=true;
 token='';assert.equal((await handler(request())).status,503);token='server-secret-test';
 assert.equal((await handler(request({'x-file-name':'..%2Fsecret.zip'}))).status,400);
 assert.equal((await handler(request({'content-length':String(21*1048576)}))).status,413);
 assert.equal((await handler(request({},new Uint8Array([1,2,3,4])))).status,400);
 assert.equal(puts.length,0,'Rejected requests never write GitHub');
 let response=await handler(request());assert.equal(response.status,200);let data=await response.json();assert.equal(data.file_bytes,6);assert.equal(data.replaced,false);assert(data.download_url.includes(commit));assert.equal(puts[0].sha,undefined);assert(!JSON.stringify(data).includes('server-secret-test'));
 existing=true;response=await handler(request());assert.equal(response.status,200);data=await response.json();assert.equal(data.replaced,true);assert.equal(puts[1].sha,sha);assert.equal(puts[1].branch,'main');assert.equal(Buffer.from(puts[1].content,'base64')[0],80);
 assert(calls.filter(s=>s.includes('api.github.com')).every(s=>s.includes("Baldur's%20Gate%203%20Romanian%20Translate/translation.zip")));
 for(const [status,code] of [[401,'github_token_invalid'],[403,'github_write_denied'],[404,'github_repository_access'],[409,'github_conflict'],[422,'github_validation'],[429,'github_rate_limit'],[503,'github_unavailable']]){
  githubWriteStatus=status;response=await handler(request());data=await response.json();
  assert.equal(data.code,code);assert.equal(data.github_status,status);assert(!JSON.stringify(data).includes('server-secret-test'),'Upstream text and secrets must never be echoed');
 }
 githubWriteStatus=0;githubReadStatus=401;const before=puts.length;
 response=await handler(request());assert.equal((await response.json()).code,'github_token_invalid');assert.equal(puts.length,before);
 githubReadStatus=0;token='  server-secret-test\n';assert.equal((await handler(request())).status,200,'Whitespace around saved secret is ignored');
 console.log('PASS: server-validated owner and moderator, CORS, missing secret, archive size/signatures, traversal protection, safe GitHub path, overwrite SHA and pinned download. No real upload.');
})().catch(e=>{console.error(e);process.exitCode=1;});
