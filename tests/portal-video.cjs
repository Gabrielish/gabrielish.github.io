const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const url=process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/';
  try{
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'no-preference'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelector('.banner-video').currentTime>.2,null,{timeout:30000});
      const video=page.locator('.banner-video');
      assert(await video.evaluate(v=>v.muted&&v.loop&&v.playsInline));
      assert.equal(await page.locator('#banner-video-toggle').count(),0);
      assert.equal(await video.evaluate(v=>v.controls),false);
      await page.locator('.footer').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.banner-video').paused);
      await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>!document.querySelector('.banner-video').paused);
      await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.banner-video').paused);
      assert.equal(await page.locator('#banner-video-toggle').count(),0);
      assert.equal(await page.locator('.project-banner').evaluate(el=>el.classList.contains('video-loaded')),false);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.close();
    }
    const reduced=await browser.newPage({reducedMotion:'reduce'});let mediaRequests=0;
    reduced.on('request',r=>{if(r.url().includes('About_infinity_video'))mediaRequests++});
    await reduced.goto(url,{waitUntil:'networkidle'});assert.equal(mediaRequests,0,'No video download for reduced motion');assert.equal(await reduced.locator('video').getAttribute('src'),null);await reduced.close();
    const saving=await browser.newPage();await saving.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true}}));
    await saving.goto(url,{waitUntil:'networkidle'});assert.equal(await saving.locator('video').getAttribute('src'),null,'No video download for data saver');await saving.close();
    const failure=await browser.newPage();
    await failure.route('**/About_infinity_video*.mp4',r=>r.abort());await failure.route('**/about/video-still.jpg',r=>r.abort());
    await failure.goto(url,{waitUntil:'networkidle'});await failure.waitForFunction(()=>document.querySelector('.banner-art').hidden);
    assert.equal(await failure.locator('.project-banner').evaluate(el=>el.classList.contains('video-loaded')),false);
    assert.equal(await failure.locator('#banner-video-toggle').count(),0);await failure.close();
    console.log('PASS: official video plays desktop/mobile without manual controls, mute/loop/inline, offscreen pause, reduced motion/data-saver skip download, plain dark fallback on external failure.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
