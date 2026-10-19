const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const width of [320,390,820,1440]){
      const page=await browser.newPage({viewport:{width,height:width===320?568:1000},reducedMotion:'reduce'});
      await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={supabaseUrl:"",supabasePublishableKey:"",authEnabled:false};'}));
      await page.goto(process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});
      const cta=page.locator('.hero-cta');
      assert.equal(await cta.getAttribute('href'),'#descarcari');
      assert.equal(await page.locator('#banner-video-toggle').count(),0);
      assert.equal(await page.locator('video').evaluate(el=>el.controls),false);
      const surface=await page.locator('.hero-cta__surface').evaluate(el=>({blur:getComputedStyle(el).backdropFilter,bg:getComputedStyle(el).backgroundColor}));
      assert.equal(surface.blur,'blur(10px)');assert.equal(surface.bg,'rgba(0, 0, 0, 0.35)');
      assert.equal(await page.locator('.hero-availability').textContent(),'Disponibilă pentru');
      assert.deepEqual(await page.locator('.hero-platforms img').evaluateAll(els=>els.map(el=>el.alt)),['PC / Windows','macOS']);
      assert.equal(await page.locator('.hero-platforms').textContent(),'');
      const hero=await page.locator('.project-banner').boundingBox(),button=await cta.boundingBox(),platforms=await page.locator('.hero-platforms').boundingBox();
      assert(button.y>hero.y && platforms.y>=button.y+button.height && platforms.y+platforms.height<hero.y+hero.height);
      assert(button.x>=0 && button.x+button.width<=width);
      await page.waitForFunction(()=>[...document.querySelectorAll('.hero-platforms img')].every(el=>el.complete&&el.naturalWidth>0));
      assert((await page.locator('.hero-cta__frame').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('hero-button-outline.svg'));
      assert.equal(await page.locator('.hero-platforms .in-development').count(),0);
      await page.screenshot({path:`.qa/restored-hero-${width}.png`});
      await cta.hover();
      assert.equal(await page.locator('.hero-cta__hover').evaluate(el=>getComputedStyle(el).opacity),'1');
      assert.equal(await page.locator('.hero-cta__label').evaluate(el=>getComputedStyle(el).color),'rgb(23, 21, 19)');
      if(width===1440)await page.screenshot({path:'.qa/hero-cta-hover.png'});
      await cta.click();
      await page.waitForFunction(()=>location.hash==='#descarcari');
      assert(await page.locator('#descarcari').isVisible());
      await page.close();
    }
    console.log('PASS: CTA, blur/transparency, hover, PC/macOS platform SVGs, no PS5 hero label, downloads and responsive bounds.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
