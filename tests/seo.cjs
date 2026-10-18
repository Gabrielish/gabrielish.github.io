const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
(async () => {
  const expectedTitle = 'Baldur’s Gate 3 | Traducere în Limba Română';
  const expectedDescription = 'Descarcă traducerea gratuită în limba română pentru Baldur’s Gate 3. Proiect de Gabrielish, cu texte revizuite în context și atenție la acordul de gen.';
  assert.equal(html.match(/<title>([^<]+)<\/title>/)[1], expectedTitle);
  for (const attribute of ['property="og:title"', 'name="twitter:title"']) assert(html.includes(`<meta ${attribute} content="${expectedTitle}">`));
  for (const attribute of ['name="description"', 'property="og:description"', 'name="twitter:description"']) assert(html.includes(`<meta ${attribute} content="${expectedDescription}">`));
  assert(html.includes('rel="icon" href="https://gabrielish.github.io/assets/portal-favicon-96.png" type="image/png" sizes="96x96"'));
  assert(html.includes('<meta name="google-site-verification" content="FcReElyhAtWzvlXGjBjV4val1GF9FIsaZtGZnLf8BD0">'));
  assert.equal(fs.readFileSync(path.join(root, 'google104396851d87c68b.html'), 'utf8').trim(), 'google-site-verification: google104396851d87c68b.html');
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const structured = JSON.parse(json);
  const webpage = structured['@graph'].find(item => item['@type'] === 'WebPage');
  assert.equal(webpage.name, expectedTitle);
  assert.equal(webpage.description, expectedDescription);
  assert.equal(structured['@context'], 'https://schema.org');
  assert(!/camp-romania|logo-d20/.test(html),'No obsolete dice illustration in active page, fallback or share metadata');
  const logo=structured['@graph'].find(item=>item['@type']==='ImageObject');
  assert(logo.url.endsWith('/assets/portal-apple-touch-icon.png'));
  assert.equal(logo.width,180);assert.equal(logo.height,180);
  const ids = structured['@graph'].map(item => item['@id']);
  assert.equal(new Set(ids).size, ids.length);
  function checkRefs(value) {
    if (Array.isArray(value)) value.forEach(checkRefs);
    else if (value && typeof value === 'object') {
      if (value['@id']) assert(ids.includes(value['@id']), `Broken JSON-LD reference: ${value['@id']}`);
      Object.values(value).forEach(checkRefs);
    }
  }
  checkRefs(structured['@graph']);
  assert(!html.includes('name="keywords"'), 'Avoid keyword stuffing');
  assert(!json.includes('aggregateRating'), 'No fabricated ratings');
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert(sitemap.includes('<loc>https://gabrielish.github.io/</loc>'));
  assert.equal((sitemap.match(/<loc>/g) || []).length, 1);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'site.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, '/');
  for (const icon of manifest.icons) assert(fs.existsSync(path.join(root, icon.src)));
  for (const [file, dimension] of [['assets/logo-d20-romania.png', 1024], ['assets/favicon-96.png', 96], ['assets/apple-touch-icon.png', 180]]) {
    const metadata = await sharp(path.join(root, file)).metadata();
    assert.equal(metadata.width, dimension);
    assert.equal(metadata.height, dimension);
    assert(metadata.hasAlpha);
    const stats = await sharp(path.join(root, file)).stats();
    assert.equal(stats.channels[3].min, 0);
  }
  const portalIcon = await sharp(path.join(root, 'assets/portal-favicon-96.png')).metadata();
  assert.equal(portalIcon.width, 96);
  assert.equal(portalIcon.height, 96);
  const localLinks = [...html.matchAll(/(?:href|src)="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(match => match[1]);
  for (const asset of localLinks) assert(fs.existsSync(path.join(root, asset)), `Missing local asset ${asset}`);
  console.log('PASS: structured data references, canonical, sitemap, manifest, PNG sizes/alpha, local assets, no fake ratings/keyword stuffing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
