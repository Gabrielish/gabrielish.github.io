# SEO și indexare — BG3RO

Implementat: titlu descriptiv, description, canonical HTTPS, index/follow, preview-uri Open Graph/Twitter cu imagini și diacritice, date JSON-LD (creator, brand, logo, proiect de traducere, joc, website și pagină), favicon PNG de 96px, Apple touch icon, manifest și sitemap cu URL-ul canonic. Nu există procente inventate, review-uri false, ratinguri, cuvinte-cheie repetate sau promisiuni că jocul este tradus integral.

## Ce nu garantează acestea

Google decide indexarea, titlul afișat, snippetul, poziția și eventualele imagini. Nu există o metadată care să garanteze prima pagină. JSON-LD descrie conținutul; nu declarăm o firmă, o aplicație instalabilă de sine stătătoare sau eligibilitate garantată la rich results.

## Important pentru GitHub Pages la /bg3ro/

- Google gestionează faviconul și numele de site la nivelul domeniului/subdomeniului, nu separat pentru fiecare subdirector. Faviconul nostru funcționează în browser; apariția sa în căutare nu poate fi garantată pentru `/bg3ro/`.
- Google citește `https://gabrielish.github.io/robots.txt`, nu `/bg3ro/robots.txt`. Fișierul din acest repository este doar o copie pregătită pentru un eventual domeniu propriu sau root controlat. Nu modificăm alte repository-uri/site-uri pentru a-l instala la root.
- Metadatele `robots` sunt prezente direct în pagina HTML; niciun `noindex` nu este introdus de acest proiect.
- Nodul WebSite din JSON-LD rămâne semantic util, însă nu califică automat subdirectorul pentru numele de site afișat de Google.

## Pasul care trebuie făcut în contul proprietarului

1. În Google Search Console, adaugă proprietatea URL-prefix `https://gabrielish.github.io/`.
2. Alege verificarea prin meta-tag sau fișier HTML. Furnizează tagul/fișierul primit pentru a fi instalat exact; nu inventăm o valoare de verificare.
3. Trimite `https://gabrielish.github.io/sitemap.xml` în Sitemaps.
4. Inspectează URL-ul canonic și folosește Request indexing dacă este disponibil.

Nu a fost trimisă o cerere de indexare din acest proiect: nu avem o sesiune autorizată în Search Console. Reindexarea nu este instantanee și poate să nu aibă loc.

Documentație oficială:

- https://developers.google.com/search/docs/appearance/favicon-in-search
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/appearance/snippet
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/crawling/docs/robots-txt/create-robots-txt
