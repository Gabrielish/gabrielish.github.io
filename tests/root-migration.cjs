const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes('rel="canonical" href="https://gabrielish.github.io/"'));
assert(html.includes('rel="icon" href="https://gabrielish.github.io/assets/portal-favicon-96.png"'));
assert(fs.readFileSync(path.join(root,'portal-config.js'),'utf8').includes("authRedirectUrl: 'https://gabrielish.github.io/'"));
assert(fs.readFileSync(path.join(root,'portal-sidebar.js'),'utf8').includes("writeText('https://gabrielish.github.io/')"));
for(const file of ['portal.webmanifest','site.webmanifest']){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/');
}
const upload=fs.readFileSync(path.join(root,'supabase/functions/bg3ro-upload/handler.js'),'utf8');
assert(upload.includes('api.github.com/repos/Gabrielish/bg3ro/contents/'),'Upload destination must remain the original archive repository');
const old=path.join(root,'../bg3ro');
for(const file of ['index.html','portal/index.html']){
 const legacy=fs.readFileSync(path.join(old,file),'utf8');
 const script=legacy.match(/<script>([\s\S]*?)<\/script>/)[1];
 for(const input of ['https://gabrielish.github.io/bg3ro/?v=old#descarcari','https://gabrielish.github.io/bg3ro/portal/?code=synthetic-test-code#erori','https://gabrielish.github.io/bg3ro/?error=access_denied&redirect_to=https://example.invalid#discutii']){
  const url=new URL(input);let destination;
  vm.runInNewContext(script,{URL,location:{href:url.href,search:url.search,hash:url.hash,replace:value=>{destination=new URL(value);}}});
  assert.equal(destination.origin,'https://gabrielish.github.io');assert.equal(destination.pathname,'/');
  assert.equal(destination.search,url.search);assert.equal(destination.hash,url.hash);
 }
 assert(legacy.includes('noindex, follow'));
}
console.log('PASS: root canonical/favicon/auth/share/manifests; original archive upload target preserved; old redirects preserve query, OAuth code/errors and tab without open redirects.');
