(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const config = window.BG3RO_CONFIG || {};
  function thumbIcon(works) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'20',height:'20',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:`compatibility-icon${works ? '' : ' is-down'}`})) svg.setAttribute(key,value);
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d','M7 10v11H3V10h4Zm0 0 5-8a3 3 0 0 1 3 3l-1 5h5a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7');
    svg.append(path);
    return svg;
  }
  for (const [selector,works] of [['#works-count',true],['#broken-count',false]]) {
    const label=$(selector), wrapper=document.createElement('span');
    wrapper.className=`compatibility-count ${works ? 'is-working' : 'is-broken'}`;
    label.before(wrapper);wrapper.append(thumbIcon(works),label);
  }
  document.querySelectorAll('[data-works]').forEach(button=>button.prepend(thumbIcon(button.dataset.works==='true')));
  let client = null, userId = null, myRating = null, myVote = null, average = 0, busy = false, statsRequest = 0, authRequest = 0;
  let draftWorks = null, voteExpanded = false;
  function drawVotePanel() {
    const active=!!client && !!userId && draftWorks!==null;
    $('#compatibility-vote-form').hidden=!active;
    $('.compatibility-actions').hidden=active;
    $('#compatibility-vote-body').hidden=!active || !voteExpanded;
    $('.compatibility-fields').hidden=!active || !voteExpanded;
    $('#compatibility-panel-toggle').setAttribute('aria-expanded',String(active && voteExpanded));
    $('#compatibility-choice').textContent=draftWorks===false?'Nu funcționează':'Funcționează';
    document.querySelectorAll('[data-works]').forEach(b=>{
      b.setAttribute('aria-controls','compatibility-vote-form');
      b.setAttribute('aria-expanded',String(active && draftWorks=== (b.dataset.works==='true')));
    });
  }
  const platforms = { windows: 'Windows', macos: 'macOS', linux: 'Linux / Steam Deck', ps5: 'PS5', other: 'Altă platformă' };
  const setText = (selector, text) => { $(selector).textContent = text; };
  let releaseVersions = [], versionsState = 'loading';
  const versionKey = window.BG3RO_VERSIONS.key;
  function drawVersions(preferred = $('#compatibility-version').value) {
    preferred = window.BG3RO_VERSIONS.version(preferred);
    const select = $('#compatibility-version');
    const placeholder = document.createElement('option');placeholder.value = '';
    placeholder.textContent = versionsState === 'loading' ? 'Se încarcă…' : versionsState === 'error' && !releaseVersions.length ? 'Versiuni indisponibile' : releaseVersions.length ? 'Nespecificată' : 'Nicio versiune publicată';
    select.replaceChildren(placeholder);
    const choices = [...releaseVersions];
    const previous = window.BG3RO_VERSIONS.version(myVote?.mod_version);
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
    event.detail.versions.forEach(value => { if (typeof value === 'string' && value.trim() && value.trim().length <= 80 && !unique.has(versionKey(value))) unique.set(versionKey(value),window.BG3RO_VERSIONS.version(value)); });
    releaseVersions = [...unique.values()];versionsState = 'ready';drawVersions();
  });
  window.addEventListener('bg3ro:releases-unavailable', () => { versionsState = 'error';drawVersions(); });
  function status(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
  function drawStars(value) { document.querySelectorAll('[data-rating]').forEach(b => { b.classList.toggle('is-filled', Number(b.dataset.rating) <= value); b.setAttribute('aria-pressed', String(Number(b.dataset.rating) === myRating)); }); }
  function drawOwn() {
    drawStars(myRating || Math.round(average));
    $('#rating-own').hidden = !userId || !myRating;
    setText('#rating-hint', myRating ? `Evaluarea ta: ${myRating}/5` : '');
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
      const percent = total ? Math.round(works * 100 / total) : 0;
      setText('#compatibility-percent', total ? `${percent}%` : '—');setText('#compatibility-total', `${total} ${total === 1 ? 'raportare' : 'raportări'}`);
      $('#compatibility-fill').style.width = `${percent}%`;$('.compatibility-track').setAttribute('aria-valuenow', String(percent));
      setText('#works-count', `${works} funcționează`);setText('#broken-count', `${total - works} nu funcționează`);
      setText('#statistics-updated', data.last_update ? new Date(data.last_update).toLocaleDateString('ro-RO') : 'Nicio actualizare');
      const reports = Array.isArray(data.recent) ? data.recent.slice(0, 10) : [];
      setText('#recent-count', `(${reports.length})`);const list = $('#recent-compatibility-list');list.replaceChildren();
      if (!reports.length) { const item = document.createElement('li');item.textContent = 'Nu sunt încă raportări.';list.append(item); }
      reports.forEach(report => {
        const item=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('div'),author=document.createElement('strong'),content=document.createElement('div');
        item.className=report.works ? 'is-working' : 'is-broken';
        title.textContent=report.works ? 'Funcționează' : 'Nu funcționează';
        detail.className='compatibility-report-meta';author.className='compatibility-author';
        author.textContent=report.author_name || 'Utilizator';
        detail.append(author,document.createTextNode(` • ${platforms[report.platform] || 'Altă platformă'} • ${window.BG3RO_VERSIONS.version(report.mod_version) || 'Versiune nespecificată'} • ${new Date(report.updated_at).toLocaleDateString('ro-RO')}`));
        content.append(title,detail);item.append(thumbIcon(report.works),content);list.append(item);
      });
      drawOwn();
    } catch (_) { if (request !== statsRequest) return;setText('#rating-count', 'Date indisponibile');setText('#compatibility-total', 'Date indisponibile'); }
  }
  window.addEventListener('bg3ro:auth', async event => {
    const changed = client !== event.detail.client || userId !== event.detail.userId;
    client = event.detail.client;userId = event.detail.userId;
    if (!changed) return;
    draftWorks=null;voteExpanded=false;drawVotePanel();status('#compatibility-status','');status('#rating-status','');
    $('#compatibility-platform').value='windows';
    const request = ++authRequest;myRating = null;myVote = null;drawOwn();drawVersions('');
    if (!client || !userId) return;
    try {
      const [rating, vote] = await Promise.all([client.from('bg3ro_ratings').select('rating').eq('user_id', userId).maybeSingle(),client.from('bg3ro_compatibility').select('works,platform,mod_version').eq('user_id', userId).maybeSingle()]);
      if (request !== authRequest) return;
      if (!rating.error && rating.data) myRating = rating.data.rating;
      if (!vote.error && vote.data) { myVote = vote.data;if(draftWorks===null){$('#compatibility-platform').value = myVote.platform;drawVersions(myVote.mod_version);} }
      drawOwn();
    } catch (_) { /* Public statistics remain available independently. */ }
  });
  async function save(table, payload, statusId) {
    if (busy || !requireLogin()) return false;
    const actor = userId;
    busy = true;document.querySelectorAll('[data-rating],#rating-remove,[data-works],#compatibility-submit,#compatibility-change,#compatibility-panel-toggle').forEach(b => { b.disabled = true; });status(statusId, 'Se salvează…');
    try {
      const result = await client.from(table).upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' });
      if (result.error) throw result.error;
      if (actor !== userId) { status(statusId, '');return false; }
      status(statusId, statusId === '#rating-status' ? '' : 'Salvat. Mulțumesc pentru feedback!');return true;
    } catch (error) { status(statusId, /rate|limit|10 secunde/i.test(error?.message || '') ? 'Așteaptă 10 secunde înainte să modifici din nou votul.' : 'Votul nu a fost salvat. Încearcă din nou.', true);return false; }
    finally { busy = false;document.querySelectorAll('[data-rating],#rating-remove,[data-works],#compatibility-submit,#compatibility-change,#compatibility-panel-toggle').forEach(b => { b.disabled = false; }); }
  }
  document.querySelectorAll('[data-rating]').forEach(button => {
    button.addEventListener('pointerenter', () => { if (!busy) drawStars(Number(button.dataset.rating)); });
    button.addEventListener('click', async () => { const rating = Number(button.dataset.rating);if (await save('bg3ro_ratings', { rating }, '#rating-status')) { myRating = rating;drawOwn();await loadStats(); } });
  });
  $('.rating-stars').addEventListener('pointerleave', drawOwn);
  $('#rating-remove').addEventListener('click', async () => {
    if (busy || !myRating || !requireLogin()) return;
    const actor = userId, request = authRequest;
    busy = true;
    const controls = document.querySelectorAll('[data-rating],#rating-remove,[data-works],#compatibility-submit,#compatibility-change,#compatibility-panel-toggle');
    controls.forEach(button => { button.disabled = true; });
    status('#rating-status', 'Se elimină…');
    try {
      const result = await client.from('bg3ro_ratings').delete().eq('user_id', actor);
      if (request !== authRequest) return;
      if (result.error) throw result.error;
      myRating = null;status('#rating-status', '');drawOwn();
      $('[data-rating="1"]').focus({preventScroll:true});
      await loadStats();
    } catch (_) {
      if (request === authRequest) status('#rating-status', 'Evaluarea nu a fost eliminată. Încearcă din nou.', true);
    } finally {
      busy = false;controls.forEach(button => { button.disabled = false; });
    }
  });
  document.querySelectorAll('[data-works]').forEach(button => button.addEventListener('click', () => {
    if(busy || !requireLogin())return;
    draftWorks=button.dataset.works==='true';voteExpanded=true;
    status('#compatibility-status','');drawVotePanel();$('#compatibility-platform').focus({preventScroll:true});
  }));
  $('#compatibility-panel-toggle').addEventListener('click',()=>{voteExpanded=!voteExpanded;drawVotePanel();});
  $('#compatibility-change').addEventListener('click',()=>{
    const previous=draftWorks;draftWorks=null;voteExpanded=false;drawVotePanel();
    document.querySelector(`[data-works="${previous}"]`)?.focus({preventScroll:true});
  });
  $('#compatibility-vote-form').addEventListener('submit',async event=>{
    event.preventDefault();if(draftWorks===null || busy || !requireLogin())return;
    const payload={works:draftWorks,platform:$('#compatibility-platform').value,mod_version:$('#compatibility-version').value.trim()};
    if(await save('bg3ro_compatibility',payload,'#compatibility-status')){
      myVote=payload;voteExpanded=false;drawOwn();drawVotePanel();await loadStats();
    }
  });
  drawVotePanel();
  window.addEventListener('bg3ro:releases-updated', loadStats);
  loadStats();
})();
