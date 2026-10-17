const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BG3RO_BROWSER || 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = process.env.BG3RO_TEST_URL || 'http://127.0.0.1:4173';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.title(), 'Baldur’s Gate 3 în română — traducere gratuită | BG3RO');
  assert.equal(await page.locator('html').getAttribute('lang'), 'ro');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://gabrielish.github.io/');
  assert(!(await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'));
  const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];
  assert(graph.find(item => item['@type'] === 'Brand').logo['@id'].endsWith('#logo'));
  assert(graph.find(item => item['@type'] === 'CreativeWork').isAccessibleForFree);
  assert((await page.locator('link[rel="icon"]').getAttribute('href')).endsWith('favicon-96.png'));
  assert.equal(await page.locator('.brand img, .brand small').count(), 0, 'Text-only navbar brand');
  assert.equal((await page.locator('.brand').textContent()).trim(), 'BG3RO');
  assert.equal(await page.locator('.download-dice, .footer-brand img').count(), 0, 'No D20 logo in the download section or footer');
  assert((await page.locator('.intro-copy').first().textContent()).includes('lucrez singur'), 'Translation has a single author');
  assert.equal(await page.locator('.principle-icon svg').count(), 3, 'Three vector icons, not platform emoji');
  assert.equal((await page.locator('.principles').textContent()).includes('Gabrielish'), false, 'No repeated author name in the columns');
  assert.equal((await page.content()).includes('fără AI'), false, 'No inaccurate no-AI claim in visible text or metadata');
  assert((await page.locator('.intro-copy').first().textContent()).includes('Sunt Gabrielish'));
  assert.equal(await page.locator('.tricolor-divider').count(), 0, 'No tricolor decoration under the introduction');
  const objectiveLines = await page.locator('.intro-objective').evaluate(el => {
    return [...el.querySelectorAll('span')].reduce((count, span) => {
      const range = document.createRange(); range.selectNodeContents(span);
      return count + new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size;
    }, 0);
  });
  assert.equal(objectiveLines, 2, 'Objective paragraph uses two lines on desktop');
  assert.equal(await page.locator('.intro-objective > span').count(), 2, 'Each objective sentence has its own desktop line');
  assert((await page.locator('.intro-scope').textContent()).includes('nu un dublaj'));
  assert(!(await page.locator('body').textContent()).includes('Vocile lor.'));
  assert(await page.locator('.hero-art').evaluate(img => img.complete && img.naturalWidth > 0));
  assert.equal(await page.locator('.embers .ember').count(), 34, 'Brighter broad firefly field on desktop');
  const fireflyCoverage = await page.locator('.embers').evaluate(el => el.getBoundingClientRect().width / window.innerWidth);
  assert(fireflyCoverage >= .8, 'Fireflies cover at least 80% of page width');
  assert.equal(await page.locator('.hero-actions a span').count(), 0, 'No diagonal arrow inside the hero button');
  assert.equal(await page.locator('.ornate-frame').count(), 6);
  assert.equal(await page.locator('.voices, .companion-picker, [data-companion]').count(), 0, 'Companion section removed');
  assert.equal(await page.locator('.eyebrow > span').count(), 0, 'Section headings are unnumbered');
  for (const selector of ['.journal-rule', '.last-word .ornament']) {
    assert(await page.locator(selector).evaluate(el => getComputedStyle(el).backgroundImage.includes('divider-double-gold.svg')));
  }
  assert(await page.locator('.principles').evaluate(el => getComputedStyle(el,'::before').backgroundImage.includes('divider-double-gold.svg')));
  assert.equal(await page.locator('.nav-download').getAttribute('href'), '#sustinere');
  assert.equal((await page.locator('.nav-download').textContent()).trim(), 'Susține proiectul');
  assert.equal(await page.locator('#sustinere a').first().getAttribute('href'), 'https://www.patreon.com/cw/Gabrielish');
  assert.equal(await page.locator('#sustinere a').nth(1).getAttribute('href'), 'https://ko-fi.com/gabrielish');
  assert.equal(await page.locator('.support-dice-art, .button svg, .button img, .button [aria-hidden="true"]').count(), 0, 'Text-only CTA buttons; no donation logo');
  const supportLayout = await page.locator('.support-panel').evaluate(el => {
    const copy = el.querySelector('.support-copy').getBoundingClientRect();
    const actions = el.querySelector('.support-actions').getBoundingClientRect();
    return actions.left >= copy.right && Math.abs(actions.top - copy.top) < 200;
  });
  assert(supportLayout, 'Support text left; donation buttons right');
  assert(await page.locator('.journal-wrap').evaluate(el => getComputedStyle(el, '::before').backgroundImage.includes('corner-small-left-top.svg')));
  assert(!(await page.locator('#instalare').evaluate(el => getComputedStyle(el, '::before').backgroundImage)).includes('url('), 'Closing section stays image-free');
  assert.equal(await page.locator('.brand').evaluate(el => getComputedStyle(el).fontFamily), await page.locator('.hero-title').evaluate(el => getComputedStyle(el).fontFamily));
  assert.equal(await page.locator('.dot-grid i').count(), 9);
  assert.equal(await page.locator('.menu-toggle').isVisible(), false, 'No phone menu on desktop');
  assert.equal(await page.locator('.hero-actions .button').count(), 1);
  for (const selector of ['.hero-actions .button-gold', '.nav-download']) {
    const button = page.locator(selector).first();
    assert.equal(await button.evaluate(el => getComputedStyle(el).clipPath), 'none');
    assert.equal(await button.evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    assert(await button.evaluate((el, nav) => getComputedStyle(el, '::before').backgroundImage.includes(nav ? 'radial-gradient' : 'button-'), selector === '.nav-download'));
    await button.hover();
    await page.waitForTimeout(450);
    assert.equal(await button.evaluate(el => getComputedStyle(el).transform), 'none');
    assert.equal(await button.evaluate(el => getComputedStyle(el, '::after').opacity), '1', 'Hover reveals the filled cream shape');
    if (selector === '.nav-download') {
      assert.equal(await button.evaluate(el => getComputedStyle(el, '::after').backgroundColor), 'rgb(255, 255, 255)');
      assert.equal(await button.evaluate(el => getComputedStyle(el, '::before').opacity), '1', 'Parchment base stays visible during hover');
      assert.equal(await button.evaluate(el => getComputedStyle(el, '::before').filter), 'none', 'No second brightness hover');
      assert.equal(await button.evaluate(el => getComputedStyle(el, '::after').filter), 'none');
      assert(await button.evaluate(el => getComputedStyle(el, '::after').maskImage.includes('diamond-hover-mask-corner')));
    } else assert(await button.evaluate(el => getComputedStyle(el, '::after').backgroundImage.includes('button-filled.svg')));
    if (selector.includes('hero-actions')) assert.equal(await button.evaluate(el => getComputedStyle(el).color), 'rgb(23, 21, 19)');
  }
  const navItem = page.locator('#navigation a[href="#proiect"]');
  await page.mouse.move(0, 300);
  await page.waitForTimeout(450);
  assert.equal(await navItem.evaluate(el => getComputedStyle(el).color), 'rgb(251, 206, 160)');
  await navItem.hover();
  await page.waitForTimeout(450);
  assert.equal(await navItem.evaluate(el => getComputedStyle(el, '::after').opacity), '1');
  assert.equal(await navItem.evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
  assert(await navItem.evaluate(el => getComputedStyle(el, '::after').backgroundImage.includes('nav-underline.svg')));
  await page.locator('[data-gender="male"]').click();
  assert.equal(await page.locator('[data-line="heal"]').textContent(), 'l-a vindecat');
  assert.equal(await page.locator('[data-line="passive"]').textContent(), 'vindecat');
  assert.equal(await page.locator('[data-line="miss"]').textContent(), 'l-a ratat');
  await page.locator('[data-gender="female"]').click();
  assert.equal(await page.locator('[data-line="heal"]').textContent(), 'a vindecat-o');
  assert.equal(await page.locator('[data-line="passive"]').textContent(), 'vindecată');
  assert.equal(await page.locator('[data-line="miss"]').textContent(), 'a ratat-o');
  await page.locator('details').first().locator('summary').click();
  assert(await page.locator('details').first().evaluate(el => el.open));
  await page.locator('details').first().locator('summary').click();
  const badAnchors = await page.locator('a[href^="#"]').evaluateAll(links => links.filter(link => !document.getElementById(link.hash.slice(1))).map(link => link.hash));
  assert.deepEqual(badAnchors, []);
  assert.equal(await page.locator('.button-gold').first().getAttribute('href'), 'https://www.nexusmods.com/baldursgate3/mods/24379');
  const output = path.join(__dirname, '..', '.qa');
  fs.mkdirSync(output, { recursive: true });
  // Reveal every section through actual scroll observation before the full-page image.
  for (const section of await page.locator('.reveal').all()) { await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(70); }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  await page.screenshot({ path: path.join(output, 'hero-desktop.png') });

  for (const width of [390, 320, 768, 781, 820, 980, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(url, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `Horizontal overflow at ${width}px: ${overflow}`);
    if (width <= 768) {
      assert((await page.locator('.hero-actions .button-gold').boundingBox()).height <= 65, 'Mobile CTA must stay on one line');
      await page.locator('.menu-toggle').click();
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
      await page.locator('.menu-toggle').click();
      await page.locator('#navigation a[href="#acord"]').click();
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
    }
    if (width > 780) {
      assert.equal(await page.locator('.menu-toggle').isVisible(), false);
      assert.equal(await page.locator('#navigation').isVisible(), true, 'Desktop/tablet navbar stays visible');
    }
    if (width === 390) {
      for (const section of await page.locator('.reveal').all()) { await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(70); }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
      await page.screenshot({ path: path.join(output, 'hero-mobile.png') });
      await page.locator('#acord').screenshot({ path: path.join(output, 'features-mobile.png') });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.embers .ember').count(), 0);
  assert.equal(await page.locator('.scroll-cue svg').evaluate(el => getComputedStyle(el).animationName), 'none', 'Mouse hint respects reduced motion');
  assert.equal(await page.locator('.scroll-wheel').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await page.locator('.reveal').first().evaluate(el => getComputedStyle(el).opacity), '1');
  const noJS = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await noJS.goto(url);
  assert.equal(await noJS.locator('.reveal').first().evaluate(el => getComputedStyle(el).opacity), '1');
  assert(await noJS.locator('.button-gold').first().isVisible());
  assert.deepEqual(errors, []);
  console.log('PASS: desktop; widths 320/390/768/1024; gender forms; FAQ; menu keyboard; anchors; images; reduced motion; no-JS; no JS errors.');
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
