const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./portal-community.cjs'),'utf8'),sdk=source.slice(source.indexOf('function syntheticSDK(){'),source.indexOf('\n(async()=>'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,1440]){
 const p=await browser.newPage({viewport:{width,height:1000},hasTouch:width<600,isMobile:width<600,reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://baldursgate3.game/**',r=>r.abort());await p.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test'};"}));await p.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export const createClient=()=>(${sdk})();`}));
 await p.goto('http://127.0.0.1:4173/#erori',{waitUntil:'networkidle'});await p.waitForSelector('html.portal-ready');
 const png=Buffer.from(await p.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=90;const ctx=c.getContext('2d');ctx.fillStyle='#d7bc8a';ctx.fillRect(0,0,160,90);ctx.fillStyle='#111215';ctx.fillRect(30,20,100,50);return c.toDataURL('image/png').split(',')[1];}),'base64');
 await p.route('https://test.supabase.co/storage/**',r=>r.fulfill({contentType:'image/png',body:png}));
 const input=p.locator('#report-photo'),tiles=p.locator('.report-photo-thumbnail:not([hidden])'),file=name=>({name,mimeType:'image/png',buffer:png});
 assert.equal(await input.getAttribute('multiple'),'');
 await input.setInputFiles(Array.from({length:6},(_,i)=>file(`captura-${i}.png`)));await p.waitForFunction(()=>document.querySelectorAll('.report-photo-thumbnail:not([hidden])').length===6);
 await input.setInputFiles(Array.from({length:6},(_,i)=>file(`captura-${i+6}.png`)));await p.waitForFunction(()=>document.querySelectorAll('.report-photo-thumbnail:not([hidden])').length===12);assert.equal(await input.evaluate(el=>el.files.length),12);
 for(const tile of await tiles.all()){const box=await tile.boundingBox();assert.equal(box.width,80);assert.equal(box.height,80);}
 await p.locator('#report-photo-drop').screenshot({path:`.qa/report-gallery-${width}.png`});
 await tiles.nth(5).getByRole('button').focus();await p.keyboard.press('Enter');assert.equal(await tiles.count(),11);assert.equal(await p.getByRole('button',{name:'Elimină captura: captura-5.png',exact:true}).count(),0);
 const padded=Buffer.concat([png,Buffer.alloc(3*1024*1024-png.length)]);
 await input.setInputFiles({name:'mare.png',mimeType:'image/png',buffer:padded});await p.waitForFunction(()=>document.querySelectorAll('.report-photo-thumbnail:not([hidden])').length===12);
 await input.setInputFiles({name:'prea-mult.png',mimeType:'image/png',buffer:padded});await p.waitForFunction(()=>document.querySelector('#report-photo-status').textContent.includes('limita totală de 5 MB'));assert.equal(await tiles.count(),12);assert.equal(await input.evaluate(el=>el.files.length),12,'Over-limit batch preserves existing images');
 await p.getByRole('button',{name:'Elimină captura: mare.png',exact:true}).focus();await p.keyboard.press('Enter');assert.equal(await tiles.count(),11);
 await input.setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('<svg onload="alert(1)"/>')});await p.waitForFunction(()=>document.querySelector('#report-photo-status').textContent.includes('validă'));assert.equal(await tiles.count(),11);
 const results=await p.evaluate(async()=>{
  const calls={inserts:0,uploads:0,attaches:0},stored=new Set(),id='11111111-1111-1111-1111-111111111111';let lostReply=true,failAttach=true,paths=[];
  const client={from:()=>({insert(){calls.inserts++;return{select:()=>({maybeSingle:async()=>({data:{id},error:null})})}}}),storage:{from:()=>({upload:async(path,blob,options)=>{calls.uploads++;if(blob.type!=='image/jpeg'||options.upsert)throw Error('Unsafe upload');if(stored.has(path))return{error:{statusCode:'409',message:'Already exists'}};stored.add(path);if(stored.size===2&&lostReply){lostReply=false;return{error:{message:'Network error after upload'}};}return{error:null};},createSignedUrl:async path=>({data:{signedUrl:'https://test.supabase.co/storage/v1/object/sign/bg3ro-report-images/'+path+'?token=test'},error:null}),remove:async values=>{window.__galleryRemoved=values;return{error:null};}})},rpc:async(name,args)=>{if(name!=='bg3ro_attach_report_images')throw Error('Wrong RPC');calls.attaches++;paths=args.p_paths;if(failAttach){failAttach=false;return{error:{message:'Offline'}};}return{error:null};}};
  const api=window.BG3RO_REPORT_PHOTO;
  for(let i=0;i<2;i++){let failed=false;try{await api.publish(client,{title:'Galerie de test'});}catch(e){if(e.code!=='REPORT_PHOTO')throw e;failed=true;}if(!failed)throw Error('Expected failure');if(!document.querySelector('#report-photo').disabled)throw Error('Selection not frozen during retry');}
  await api.publish(client,{});window.__galleryPaths=paths;
  const container=document.createElement('article');container.id='gallery-result';document.querySelector('#reports-list').replaceChildren(container);
  await api.show(client,{id,screenshot_path:paths[0],screenshot_paths:paths},container);await api.cleanup(client,paths);
  document.querySelector('#report-form').reset();return{...calls,paths,removed:window.__galleryRemoved,remaining:document.querySelectorAll('.report-photo-thumbnail:not([hidden])').length};
 });
 assert.equal(results.inserts,1);assert.equal(results.uploads,12);assert.equal(results.attaches,2);assert.equal(results.paths.length,11);assert.deepEqual(results.removed,results.paths);assert.equal(results.remaining,0);assert.equal(await p.locator('#gallery-result .report-photo-link').count(),11);
 await p.locator('#gallery-result .report-photo-link').nth(7).click();await p.waitForSelector('.report-photo-viewer[open]');assert((await p.locator('.report-photo-viewer img').getAttribute('src')).includes(results.paths[7]));await p.keyboard.press('Escape');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.close();
}console.log('PASS: 12-image batches, cumulative 5 MB budget, individual removal, invalid-file retention, retry without duplicates, complete galleries/viewer/cleanup and touch layouts.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
