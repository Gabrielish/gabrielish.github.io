const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const width of [320,390,600,820,1024,1440]){
      const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(process.env.BG3RO_TEST_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
      const footer=page.locator('.footer');
      assert.equal(await footer.locator('.footer-column').count(),3);
      assert.equal(await footer.locator('.footer-intro').count(),1);
      const columns=await page.locator('.footer-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(columns,width>760?4:2);
      assert.equal(await footer.locator('.footer-bottom').count(),1);
      assert.equal(await footer.locator('a[href*="discord"],a[href*="facebook"],a[href*="youtube"]').count(),0);
      for(const id of ['despre','actualizari','descarcari','discutii','erori']){
        await footer.locator(`[data-go-tab="${id}"]`).first().click();assert(await page.locator(`#${id}`).isVisible());
      }
      await footer.locator('a[href="#intrebari-frecvente"]').click();assert(await page.locator('#intrebari-frecvente.information-panel').isVisible());await page.goBack();await page.waitForSelector('html.portal-ready');
      await footer.locator('nav[aria-labelledby="footer-information"] a[href="#confidentialitate"]').click();assert(await page.locator('#confidentialitate.information-panel').isVisible());await page.goBack();await page.waitForSelector('html.portal-ready');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
      if([390,1440].includes(width))await footer.screenshot({path:`.qa/footer-columns-${width}.png`});
      await page.close();
    }
    console.log('PASS: four-column footer, responsive two-column mobile, real resource links, tab and FAQ navigation, privacy expansion, attribution and no overflow.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
