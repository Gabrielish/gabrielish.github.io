const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,1440,1920]){
  const p=await b.newPage({viewport:{width,height:1000},reducedMotion:'no-preference'});
  await p.route('https://baldursgate3.game/**',r=>r.abort());
  await p.goto(process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await p.waitForSelector('.ember',{state:'attached'});
  const result=await p.evaluate(()=>{const hero=document.querySelector('.hero'),layer=hero.querySelector('.embers'),h=hero.getBoundingClientRect(),e=layer.getBoundingClientRect(),s=getComputedStyle(layer);return{hero:{x:h.x,y:h.y,width:h.width,height:h.height},layer:{x:e.x,y:e.y,width:e.width,height:e.height},overflow:s.overflow,pointer:s.pointerEvents,scroll:document.documentElement.scrollWidth};});
  for(const key of ['x','y','width','height'])assert(Math.abs(result.hero[key]-result.layer[key])<1,`Full hero ${key} at ${width}px`);
  assert.equal(result.overflow,'visible');assert.equal(result.pointer,'none');assert(result.scroll<=width+1);
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.embers').isVisible(),false);
  await p.close();
 }
 console.log('PASS: fireflies cover 100% of hero at 320/390/1440/1920px, no inner clipping, no horizontal overflow, reduced motion preserved.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
