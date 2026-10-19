const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [320,390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});
  await page.route('https://baldursgate3.game/**',r=>r.abort());
  await page.route('**/portal-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BG3RO_CONFIG={};'}));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  const footer=page.locator('footer.footer'),bottom=page.locator('.footer-bottom');
  assert.equal(await bottom.locator('p').count(),2);
  const text=await footer.textContent();assert(!text.includes('©'));assert(!text.includes('Video de fundal, imagine statică'));assert(!text.includes('materialele asociate aparțin titularilor lor'));
  assert.equal(await page.locator('.footer-disclaimer').textContent(),'Proiect neoficial, fără afiliere cu Larian Studios sau Wizards of the Coast.');
  assert.equal(await bottom.evaluate(el=>getComputedStyle(el).textAlign),'center');
  assert.equal(await bottom.evaluate(el=>getComputedStyle(el).alignItems),'center');
  assert.equal(await footer.locator('.footer-column').count(),3);
  assert.equal(await footer.locator('a[href="#contact"],a[href="#termeni"],a[href="#confidentialitate"],a[href="#intrebari-frecvente"]').count(),4);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width===390||width===1440)await bottom.screenshot({path:`.qa/footer-bottom-${width}.png`,style:'.topbar{visibility:hidden!important}'});
  await page.close();
 }console.log('PASS: compact centered footer, requested notices removed, non-affiliation kept, navigation preserved, 320–1440px.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
