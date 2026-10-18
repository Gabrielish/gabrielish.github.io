(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const config = window.BG3RO_CONFIG || {};
  let client = null, userId = null, myRating = null, myVote = null, average = 0, busy = false, statsRequest = 0, authRequest = 0;
  const platforms = { windows: 'Windows', macos: 'macOS', linux: 'Linux / Steam Deck', ps5: 'PS5', other: 'Altă platformă' };
  const setText = (selector, text) => { $(selector).textContent = text; };
  let releaseVersions = [], versionsState = 'loading';
  const versionKey = value => String(value || '').trim().toLowerCase();
  function drawVersions(preferred = $('#compatibility-version').value) {
    const select = $('#compatibility-version');
    const placeholder = document.createElement('option');placeholder.value = '';
    placeholder.textContent = versionsState === 'loading' ? 'Se încarcă…' : versionsState === 'error' && !releaseVersions.length ? 'Versiuni indisponibile' : releaseVersions.length ? 'Nespecificată' : 'Nicio versiune publicată';
    select.replaceChildren(placeholder);
    const choices = [...releaseVersions];
    const previous = String(myVote?.mod_version || '').trim();
    if (previous && !choices.some(value => versionKey(value) === versionKey(previous))) choices.push(previous);
    for (const value of choices) {
      const option = document.createElement('option');option.value = value;option.textContent = value;
      if (!releaseVersions.includes(value)) option.textContent += ' (vot anterior)';
      select.append(option);
    }
    select.value = choices.find(value => versionKey(value) === versionKey(preferred)) || '';
  }
  window.addEventListener('bg3ro:releases-updated', event => {
    if (!Array.isArray(event.detail?.versions)) return;
    const unique = new Map();
    event.detail.versions.forEach(value => { if (typeof value === 'string' && value.trim() && value.trim().length <= 80 && !unique.has(versionKey(value))) unique.set(versionKey(value),value.trim()); });
    releaseVersions = [...unique.values()];versionsState = 'ready';drawVersions();
  });
  window.addEventListener('bg3ro:releases-unavailable', () => { versionsState = 'error';drawVersions(); });
  function status(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
  function drawStars(value) { document.querySelectorAll('[data-rating]').forEach(b => { b.classList.toggle('is-filled', Number(b.dataset.rating) <= value); b.setAttribute('aria-pressed', String(Number(b.dataset.rating) === myRating)); }); }
  function drawOwn() {
    drawStars(myRating || Math.round(average));
    setText('#rating-hint', userId ? (myRating ? `Evaluarea ta: ${myRating} din 5. Poți modifica nota.` : 'Alege o notă de la 1 la 5 stele.') : 'Conectează-te cu Discord pentru a evalua.');
    document.querySelectorAll('[data-works]').forEach(b => b.setAttribute('aria-pressed', String(myVote !== null && String(myVote.works) === b.dataset.works)));
  }
  function requireLogin() { if (client && userId) return true; $('.topbar [data-auth-open]')?.click(); return false; }
  async function loadStats() {
    const request = ++statsRequest;
    if (!config.supabaseUrl || !config.supabasePublishableKey) return;
    try {
      // Intentionally anonymous: only public aggregate columns, no user JWT or identity.
      const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/bg3ro_sidebar_stats`, { headers: { apikey: config.supabasePublishableKey }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Stats unavailable');
      const data = await response.json(); if (request !== statsRequest) return;
      const count = Math.max(0, Number(data.rating_count) || 0), total = Math.max(0, Number(data.compatibility_count) || 0), works = Math.max(0, Number(data.works_count) || 0);
      average = Math.max(0, Math.min(5, Number(data.rating_average) || 0));
      setText('#rating-average', count ? average.toFixed(1) : '—');setText('#rating-count', `${count} ${count === 1 ? 'evaluare' : 'evaluări'}`);
      setText('#statistics-ratings', String(count));setText('#statistics-compatibility', String(total));
      const percent = total ? Math.round(works * 100 / total) : 0;
      setText('#compatibility-percent', total ? `${percent}%` : '—');setText('#compatibility-total', `${total} ${total === 1 ? 'raportare' : 'raportări'}`);
      $('#compatibility-fill').style.width = `${percent}%`;$('.compatibility-track').setAttribute('aria-valuenow', String(percent));
      setText('#works-count', `${works} funcționează`);setText('#broken-count', `${total - works} nu funcționează`);
      setText('#statistics-updated', data.last_update ? new Date(data.last_update).toLocaleDateString('ro-RO') : 'Nicio actualizare');
      const reports = Array.isArray(data.recent) ? data.recent.slice(0, 10) : [];
      setText('#recent-count', `(${reports.length})`);const list = $('#recent-compatibility-list');list.replaceChildren();
      if (!reports.length) { const item = document.createElement('li');item.textContent = 'Nu sunt încă raportări.';list.append(item); }
      reports.forEach(report => { const item = document.createElement('li'), title = document.createElement('strong'), detail = document.createElement('span');title.textContent = report.works ? 'Funcționează' : 'Nu funcționează';detail.textContent = `${platforms[report.platform] || 'Altă platformă'}${report.mod_version ? ` · ${report.mod_version}` : ''} · ${new Date(report.updated_at).toLocaleDateString('ro-RO')}`;item.append(title, detail);list.append(item); });
      drawOwn();
    } catch (_) { if (request !== statsRequest) return;setText('#rating-count', 'Date indisponibile');setText('#compatibility-total', 'Date indisponibile');setText('#statistics-ratings', '—');setText('#statistics-compatibility', '—'); }
  }
  window.addEventListener('bg3ro:auth', async event => {
    const changed = client !== event.detail.client || userId !== event.detail.userId;
    client = event.detail.client;userId = event.detail.userId;
    if (!changed) return;
    const request = ++authRequest;myRating = null;myVote = null;drawOwn();drawVersions('');
    if (!client || !userId) return;
    try {
      const [rating, vote] = await Promise.all([client.from('bg3ro_ratings').select('rating').eq('user_id', userId).maybeSingle(),client.from('bg3ro_compatibility').select('works,platform,mod_version').eq('user_id', userId).maybeSingle()]);
      if (request !== authRequest) return;
      if (!rating.error && rating.data) myRating = rating.data.rating;
      if (!vote.error && vote.data) { myVote = vote.data;$('#compatibility-platform').value = myVote.platform;drawVersions(myVote.mod_version); }
      drawOwn();
    } catch (_) { /* Public statistics remain available independently. */ }
  });
  async function save(table, payload, statusId) {
    if (busy || !requireLogin()) return false;
    const actor = userId;
    busy = true;document.querySelectorAll('[data-rating],[data-works]').forEach(b => { b.disabled = true; });status(statusId, 'Se salvează…');
    try {
      const result = await client.from(table).upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' });
      if (result.error) throw result.error;
      if (actor !== userId) { status(statusId, '');return false; }
      status(statusId, 'Salvat. Mulțumesc pentru feedback!');return true;
    } catch (error) { status(statusId, /rate|limit|10 secunde/i.test(error?.message || '') ? 'Așteaptă 10 secunde înainte să modifici din nou votul.' : 'Votul nu a fost salvat. Încearcă din nou.', true);return false; }
    finally { busy = false;document.querySelectorAll('[data-rating],[data-works]').forEach(b => { b.disabled = false; }); }
  }
  document.querySelectorAll('[data-rating]').forEach(button => {
    button.addEventListener('pointerenter', () => { if (!busy) drawStars(Number(button.dataset.rating)); });
    button.addEventListener('click', async () => { const rating = Number(button.dataset.rating);if (await save('bg3ro_ratings', { rating }, '#rating-status')) { myRating = rating;drawOwn();await loadStats(); } });
  });
  $('.rating-stars').addEventListener('pointerleave', drawOwn);
  document.querySelectorAll('[data-works]').forEach(button => button.addEventListener('click', async () => {
    const payload = { works: button.dataset.works === 'true', platform: $('#compatibility-platform').value, mod_version: $('#compatibility-version').value.trim() };
    if (await save('bg3ro_compatibility', payload, '#compatibility-status')) { myVote = payload;drawOwn();await loadStats(); }
  }));
  $('#share-project').addEventListener('click', async () => { try { await navigator.clipboard.writeText('https://gabrielish.github.io/');status('#share-status', 'Link copiat.'); } catch (_) { status('#share-status', 'https://gabrielish.github.io/'); } });
  window.addEventListener('bg3ro:releases-updated', loadStats);
  loadStats();
})();
