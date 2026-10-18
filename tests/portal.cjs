const {clickNav}=require('./nav-action.cjs');
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const base = process.env.BG3RO_TEST_URL || 'http://127.0.0.1:4173/';
  fs.mkdirSync('.qa',{recursive:true});
  try {
    for(const width of [320,390,600,760,820,1024,1440]) {
      const page = await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});
      await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={supabaseUrl:"",supabasePublishableKey:""};'}));
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base,{waitUntil:'networkidle'});
      await page.waitForSelector('html.portal-ready');
      assert.equal(await page.locator('h1').textContent(),'Baldur’s Gate 3');
      assert.equal(await page.locator('[role=tab]').count(),5);
      assert.equal(await page.locator('[role=tabpanel]:visible').count(),1);
      assert.equal(await page.locator('#despre [role=progressbar]').count(),3);
      assert.deepEqual(await page.locator('#despre [role=progressbar]').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('aria-valuenow'))),['80','20','20']);
      assert.equal(await page.locator('a[href*="bg3ro-old"]').count(),0);
      for(const id of ['despre','actualizari','descarcari','discutii','erori']) {
        await page.locator(`#tab-${id}`).click();
        assert.equal(await page.locator(`#tab-${id}`).getAttribute('aria-selected'),'true');
        assert.equal(await page.locator('[role=tabpanel]:visible').count(),1);
        assert(await page.locator(`#${id}`).isVisible());
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No overflow ${width},${id}`);
      }
      assert(await page.locator('#erori .backend-notice').isVisible());
      assert.equal(await page.locator('#report-form:visible').count(),0,'No pretend submission without database');
      await page.locator('#tab-erori').focus();await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#tab-despre').getAttribute('aria-selected'),'true');
      await page.keyboard.press('End');assert.equal(await page.locator('#tab-erori').getAttribute('aria-selected'),'true');
      await page.keyboard.press('Home');assert.equal(await page.locator('#tab-despre').getAttribute('aria-selected'),'true');
      await page.locator('.sidebar [data-go-tab="descarcari"]').click();assert(await page.locator('#descarcari').isVisible());
      await page.goBack();assert(await page.locator('#despre').isVisible());
      await clickNav(page,'.topbar [data-auth-open]');assert(await page.locator('#auth-dialog').isVisible());
      assert(await page.locator('#auth-unavailable').isVisible());await page.keyboard.press('Escape');
      assert.equal(await page.locator('#auth-dialog:visible').count(),0);
      await page.locator('a[href="#confidentialitate"]').click();assert(await page.locator('#confidentialitate').evaluate(el=>el.open));
      assert.deepEqual(errors,[]);
      if([390,1440].includes(width)) {
        await page.goto(base,{waitUntil:'networkidle'});await page.waitForSelector('html.portal-ready');
        await page.screenshot({path:`.qa/portal-checked-${width}.png`,fullPage:true});
        for(const id of ['actualizari','descarcari','discutii','erori']){await page.locator(`#tab-${id}`).click();await page.screenshot({path:`.qa/portal-${id}-${width}.png`,fullPage:true});}
      }
      await page.close();
    }
    const page = await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
    await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(await page.locator('.tab-panel:visible').count(),5);
    assert.equal(await page.locator('a[href*="tab=files"]').count(),1,'Only the sidebar Nexus download remains without JavaScript');
    await page.close();
    console.log('PASS: five real tab panels, hash/history/keyboard, confirmed progress, download links, honest disconnected community, dialog/privacy, responsive 320–1440px and no-JS.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
