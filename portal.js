(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const ids = ['despre', 'actualizari', 'descarcari', 'discutii', 'erori', 'mesaje'];
  let messagesAllowed = false;
  const informationIds = ['contact', 'intrebari-frecvente', 'confidentialitate', 'termeni'];
  const routeIds = [...ids, ...informationIds];
  const tabs = $$('.tab-list a');
  const panels = ids.map(id => document.getElementById(id));
  const tablist = $('.tab-list');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Secțiunile proiectului');
  tabs.forEach(tab => tab.setAttribute('role', 'tab'));
  panels.forEach(panel => panel.setAttribute('role', 'tabpanel'));
  function setTab(id, focus = false) {
    const selected = routeIds.includes(id) && (id !== 'mesaje' || messagesAllowed) ? id : 'despre';
    tabs.forEach((tab, index) => {
      const active = ids[index] === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.setAttribute('aria-controls', ids[index]);
      tab.tabIndex = active || (informationIds.includes(selected) && index === 0) ? 0 : -1;
      panels[index].hidden = !active;
      panels[index].tabIndex = 0;
      if (active && focus) tab.focus();
    });
    informationIds.forEach(route => {
      const panel = document.getElementById(route);panel.hidden = route !== selected;panel.tabIndex = 0;
      if (route === selected && focus) panel.focus({ preventScroll: true });
    });
    window.dispatchEvent(new CustomEvent('bg3ro:tab', {detail:{id:selected}}));
  }
  function goTab(id, focus = false) {
    if (!routeIds.includes(id) || (id === 'mesaje' && !messagesAllowed)) return;
    history.pushState(null, '', `#${id}`);
    setTab(id, focus);
  }
  setTab(location.hash.slice(1));
  if (informationIds.includes(location.hash.slice(1))) requestAnimationFrame(() => tablist.scrollIntoView({ block: 'start', behavior: 'instant' }));
  tabs.forEach((tab, i) => tab.addEventListener('click', event => { event.preventDefault(); goTab(ids[i]); }));
  $$('[data-go-tab]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    if (link.closest('#auth-dialog')) $('#auth-dialog').close();
    goTab(link.dataset.goTab, true);
    const target = link.dataset.goTarget ? document.getElementById(link.dataset.goTarget) : $('.tab-list');
    target?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }));
  tablist.addEventListener('keydown', event => {
    const availableTabs = tabs.filter(tab => !tab.hidden);
    const index = availableTabs.indexOf(document.activeElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? availableTabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + availableTabs.length) % availableTabs.length;
    goTab(availableTabs[target].id.replace('tab-', ''), true);
  });
  addEventListener('popstate', () => setTab(location.hash.slice(1)));
  addEventListener('hashchange', () => { if (routeIds.includes(location.hash.slice(1))) setTab(location.hash.slice(1)); });

  let client = null, user = null, moderator = false, page = 0, reportsLimit = 20, reportsRequest = 0, commentsRequest = 0;
  let toastTimer, workDirty = false;
  const config = window.BG3RO_CONFIG || {};
  const authEnabled = config.authEnabled !== false;
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.supabaseUrl || '') && !!config.supabasePublishableKey;
  const dialog = $('#auth-dialog');
  const callbackURL = new URL(location.href);
  const authCode = callbackURL.searchParams.get('code');
  const authError = callbackURL.searchParams.has('error') || callbackURL.searchParams.has('error_description');
  let discordConsentRequired = authError;
  function discordWasAuthorized() { try { return localStorage.getItem('bg3ro-discord-authorized') === '1'; } catch (_) { return false; } }
  if (authCode || authError) {
    ['code','error','error_code','error_description'].forEach(key => callbackURL.searchParams.delete(key));
    history.replaceState(null, '', callbackURL.pathname + callbackURL.search + callbackURL.hash);
  }
  const statusLabels = { pending: 'În verificare', approved: 'Publicat', rejected: 'Nepublicat', new: 'Nou', investigating: 'În lucru', resolved: 'Rezolvat', closed: 'Închis' };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function toast(message) {
    clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6500);
  }
  function formStatus(form, message, error = false) {
    const target = form.querySelector('.form-status'); target.textContent = message; target.classList.toggle('error', error);
  }
  function readableError(error) {
    if (error?.code === 'REPORT_PHOTO') return error.message;
    const message = error?.message || '';
    if (/rate|limit|too many|30 de secunde|zilnic/i.test(message)) return 'Prea multe încercări. Așteaptă puțin înainte să trimiți din nou.';
    if (/expired|invalid.*token|otp/i.test(message)) return 'Conectarea a expirat. Încearcă din nou cu Discord.';
    if (/fetch|network/i.test(message)) return 'Conexiunea nu a reușit. Verifică internetul și încearcă din nou.';
    return 'Operația nu a reușit. Încearcă din nou; dacă persistă, contactează proiectul pe Nexus Mods.';
  }
  async function submit(form, action) {
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    if (form.elements.website?.value) { formStatus(form, 'Trimiterea a fost blocată.', true); return; }
    button.disabled = true; formStatus(form, 'Se trimite…');
    try { await action(); } catch (error) { formStatus(form, readableError(error), true); }
    finally { button.disabled = false; }
  }
  function dateText(value) { return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium' }).format(new Date(value)); }
  function syncAuth() {
    const member = !!user && !user.is_anonymous;
    $$('[data-auth-gate]').forEach(gate => { gate.hidden = !!user || !client || !authEnabled; });
    $$('[data-user-form]').forEach(form => { form.hidden = !user; });
    $$('[data-auth-open]').forEach(button => { button.hidden = member; });
    $('#sign-out').hidden = !user;
    $('#sign-out').textContent = user?.is_anonymous ? 'Ieși din modul oaspete' : 'Deconectare';
    $('#my-reports').hidden = !client;
    $('#admin-tools').hidden = !moderator;
    messagesAllowed = moderator;
    $('#tab-mesaje').hidden = !moderator;
    if (location.hash === '#mesaje') {
      if (!moderator) history.replaceState(null, '', location.pathname + location.search + '#despre');
      setTab(moderator ? 'mesaje' : 'despre');
    } else if (!moderator) $('#mesaje').hidden = true;
    $('#work-editor').hidden = !moderator;
    if (!moderator) { workDirty = false; $('#work-form').reset(); }
    $('#reports-heading').textContent = 'Erori raportate';
    $('#discussion-form button[type="submit"]').textContent = 'Publică mesajul';
    $('#discord-login').disabled = !client || !authEnabled;
    window.dispatchEvent(new CustomEvent('bg3ro:auth', { detail: { client, userId: member ? user.id : null, moderator, guest: !!user?.is_anonymous } }));
    if (dialog.open && !user) {
      $('#auth-unavailable').hidden = !!client && authEnabled;
      $('#discord-login-form').hidden = !client || !authEnabled;
    }
  }
  $$('[data-auth-open]').forEach(button => button.addEventListener('click', () => {
    $('#auth-unavailable').hidden = !!client && authEnabled;
    $('#discord-login-form').hidden = !client || !authEnabled;
    dialog.showModal();
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  $$('[data-guest-start]').forEach(button => button.addEventListener('click', async () => {
    if (!client || button.disabled) return;
    button.disabled = true;
    try {
      const { data, error } = await client.auth.signInAnonymously();
      if (error || !data.session) throw error || new Error('Guest session unavailable');
      await sessionChanged(data.session);
      $('#'+button.dataset.guestStart+'-name').focus();
    } catch (_) { toast('Modul oaspete nu a putut fi pornit. Încearcă din nou sau conectează-te cu Discord.'); }
    finally { button.disabled = false; }
  }));
  $('#discord-login-form').addEventListener('submit', event => {
    event.preventDefault(); if (!client || !authEnabled) return;
    const form = event.currentTarget;
    submit(form, async () => {
      sessionStorage.setItem('bg3ro-return-tab', routeIds.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'discutii');
      const { error } = await client.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: config.authRedirectUrl || new URL('./', location.href).href, queryParams: { prompt: !discordConsentRequired && discordWasAuthorized() ? 'none' : 'consent' } } });
      if (error) throw error;
      formStatus(form, 'Se deschide Discord…');
    });
  });
  $('#sign-out').addEventListener('click', async () => {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) { toast(readableError(error)); return; }
    user = null; moderator = false; syncAuth(); $('#reports-list').replaceChildren();
    $('#discussion-form').reset(); $('#report-form').reset(); cancelReply();
    await Promise.all([loadComments(), loadReports()]); toast('Te-ai deconectat.');
  });
  async function sessionChanged(session) {
    user = session?.user || null; moderator = false;
    if (user && !user.is_anonymous) {
      try { localStorage.setItem('bg3ro-discord-authorized', '1'); } catch (_) {}
      const { data, error } = await client.rpc('bg3ro_is_moderator');
      if (!error) moderator = data === true;
      if (!$('#discussion-name').value) $('#discussion-name').value = String(user.user_metadata?.full_name || user.user_metadata?.name || '').slice(0, 40);
      if (!$('#report-name').value) $('#report-name').value = String(user.user_metadata?.full_name || user.user_metadata?.name || '').slice(0, 40);
    }
    if (user && !user.is_anonymous && dialog.open) dialog.close();
    syncAuth(); await Promise.all([loadComments(), loadReports(), loadProgress()]);
  }
  async function loadProgress() {
    if (!client) return;
    const { data, error } = await client.from('bg3ro_project_status').select('translation_percent,review_percent,testing_percent,work_title,work_body,work_note').eq('id', 1).maybeSingle();
    if (error || !data) return;
    for (const [kind, field, input] of [['translation','translation_percent','progress-value'],['review','review_percent','progress-review-value'],['testing','testing_percent','progress-testing-value']]) {
      const value = Number(data[field]);
      if (!Number.isFinite(value)) continue;
      const percent = Math.max(0, Math.min(100, value));
      $(`#${kind}-percent`).textContent = `${percent}%`;
      $(`#${kind}-progress .progress-fill`).style.width = `${percent}%`;
      $(`#${kind}-progress`).setAttribute('aria-valuenow', String(percent));
      $(`#${input}`).value = percent;
    }
    for (const field of ['title','body','note']) {
      const output = $(`#current-work-${field}`), value = data[`work_${field}`];
      if (typeof value === 'string') output.textContent = value;
      if (field === 'note') output.hidden = !output.textContent.trim();
      if (!workDirty) $(`#work-${field}`).value = output.textContent;
    }
  }
  $('#work-form').addEventListener('input', () => { workDirty = true; });
  $('#work-form').addEventListener('submit', event => {
    event.preventDefault(); if (!client || !moderator) return;
    submit(event.currentTarget, async () => {
      const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
      Object.keys(values).forEach(key => { values[key] = values[key].trim(); });
      if (!values.work_title || !values.work_body) throw new Error('Empty work content');
      const { data, error } = await client.from('bg3ro_project_status').update(values).eq('id', 1).select('work_title,work_body,work_note').maybeSingle();
      if (error || !data) throw error || new Error('Work section not saved');
      workDirty = false; await loadProgress(); formStatus(form, 'Secțiunea a fost salvată.');
    });
  });
  async function loadUpdates() {
    const target = $('#updates-list');
    if (!client) { target.replaceChildren(element('p', 'small', 'Nicio actualizare publicată încă în acest portal. Istoricul versiunilor publice este pe Nexus Mods.')); return; }
    const { data, error } = await client.from('bg3ro_project_updates').select('id,title,body,published_at').order('published_at', { ascending: false }).limit(30);
    if (error) { target.replaceChildren(element('p', 'small', 'Actualizările nu au putut fi încărcate. Consultă istoricul pe Nexus Mods.')); return; }
    target.replaceChildren();
    if (!data.length) target.append(element('p', 'small release-empty-news', 'Nu sunt încă anunțuri separate publicate în acest portal. Versiunile publicate apar automat mai sus.'));
    data.forEach(update => {
      const article = element('article', 'update-article');
      article.append(element('time', 'update-date', dateText(update.published_at)), element('h3', '', update.title), element('p', '', update.body));
      if (moderator) article.append(actionButton('Șterge actualizarea', async () => {
        if (!confirm('Ștergi această actualizare publică?')) return;
        const result = await client.from('bg3ro_project_updates').delete().eq('id', update.id);
        if (result.error) throw result.error; await loadUpdates();
      }));
      target.append(article);
    });
    window.dispatchEvent(new Event('bg3ro:updates-loaded'));
  }
  function buttonIcon(button, paths) {
    const label = element('span', '', button.textContent);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'})) svg.setAttribute(key,value);
    paths.forEach(d=>{const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.append(path);});
    button.replaceChildren(svg,label);
  }
  function actionButton(label, action) {
    const button = element('button', 'btn secondary small-btn', label); button.type = 'button';
    button.addEventListener('click', async () => {
      if (button.disabled) return; button.disabled = true;
      try { await action(); } catch (error) { toast(readableError(error)); } finally { button.disabled = false; }
    });
    return button;
  }
  async function loadComments() {
    const ticket = ++commentsRequest;
    const target = $('#discussion-list');
    if (!client) { target.replaceChildren(element('p', 'small', 'Discuțiile vor apărea aici după conectarea comunității.')); return; }
    const fields = 'id,author_id,author_name,title,body,status,parent_id,created_at,is_guest,author_avatar_url';
    const { data, count, error } = await client.from('bg3ro_discussion_posts').select(fields, { count: 'exact' }).is('parent_id', null).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 20, page * 20 + 19);
    if (ticket !== commentsRequest) return;
    if (error) { target.replaceChildren(element('p', 'small', 'Discuțiile nu au putut fi încărcate. Încearcă din nou mai târziu.')); return; }
    if (!data.length && page > 0) { page--; return loadComments(); }
    target.replaceChildren(); $('#discussion-count').textContent = `${count || 0} discuții`;
    $('#previous-comments').hidden = page === 0; $('#next-comments').hidden = (page + 1) * 20 >= count;
    $('#comments-page').textContent = count ? `Pagina ${page + 1}` : '';
    if (!data.length) { const empty = element('div', 'empty-state'); empty.append(element('h3', '', 'Deschide conversația'), element('p', 'small', 'Nu sunt încă mesaje publicate. Poți fi primul care lasă o întrebare sau o sugestie.')); target.append(empty); }
    const threads = new Map();
    function renderPost(post, parent) {
      const article = element('article', parent ? 'post reply' : 'post'); article.id = `post-${post.id}`;
      const avatar = element('img', 'post-avatar');
      const remote = !post.is_guest && /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(avatars\/[0-9]+\/[A-Za-z0-9_]+\.(png|jpg|jpeg|webp|gif)|embed\/avatars\/[0-9]+\.png)(\?size=[0-9]+)?$/.test(post.author_avatar_url || '');
      avatar.src = remote ? post.author_avatar_url : './assets/discussion-avatar.svg';
      avatar.classList.toggle('post-avatar-default', !remote); avatar.alt = ''; avatar.width = 44; avatar.height = 44; avatar.loading = 'lazy'; avatar.referrerPolicy = 'no-referrer';
      if (remote) avatar.addEventListener('error', () => { avatar.classList.add('post-avatar-default'); avatar.src = './assets/discussion-avatar.svg'; }, { once: true });
      const content = element('div', 'post-content');
      const meta = element('div', 'post-meta'); meta.append(element('strong', '', post.author_name), element('time', '', dateText(post.created_at)));
      meta.querySelector('time').dateTime = post.created_at;
      if (post.is_guest) meta.append(element('span', 'post-status', 'Oaspete · nume neverificat'));
      if (post.status !== 'approved') meta.append(element('span', 'post-status', statusLabels[post.status]));
      content.append(meta);
      if (parent) content.append(element('p', 'post-mention', `@${parent.author_name}`));
      else content.append(element('h3', 'post-title', post.title));
      content.append(element('div', 'post-body', post.body));
      const actions = element('div', 'post-actions');
      if (user && post.status === 'approved') actions.append(actionButton('Răspunde', () => {
        const form = $('#discussion-form'); form.elements.parent_id.value = post.parent_id || post.id;
        form.elements.title.value = `Re: ${post.title.replace(/^Re: /, '')}`.slice(0, 120);
        $('#reply-label').hidden = false; $('#reply-label').textContent = `Răspuns pentru ${parent?.author_name || post.author_name}`;
        $('#cancel-reply').hidden = false; form.elements.body.focus();
      }));
      if (moderator && post.status !== 'approved') actions.append(actionButton('Aprobă', () => moderatePost(post.id, 'approved')));
      if (moderator && post.status !== 'rejected') actions.append(actionButton('Nu publica', () => moderatePost(post.id, 'rejected')));
      if (moderator || post.author_id === user?.id) actions.append(actionButton('Șterge', async () => {
        if (!confirm('Ștergi mesajul și răspunsurile asociate? Acțiunea nu poate fi anulată din site.')) return;
        const { error: deletionError } = await client.from('bg3ro_discussion_posts').delete().eq('id', post.id);
        if (deletionError) throw deletionError; await loadComments();
      }));
      if (actions.children.length) content.append(actions);
      article.append(avatar, content); return article;
    }
    data.forEach(post => {
      const thread = element('section', 'post-thread'), replies = element('div', 'post-replies');
      thread.setAttribute('aria-label', post.title); replies.setAttribute('aria-label', `Răspunsuri la ${post.title}`);
      thread.append(renderPost(post), replies); target.append(thread); threads.set(post.id, { post, replies });
    });
    if (!data.length) return;
    let offset = 0;
    const more = actionButton('Mai multe răspunsuri', loadReplyBatch); more.classList.add('replies-more'); more.hidden = true; target.append(more);
    async function loadReplyBatch() {
      const result = await client.from('bg3ro_discussion_posts').select(fields, { count: 'exact' }).in('parent_id', data.map(post => post.id)).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 99);
      if (ticket !== commentsRequest) return;
      if (result.error) { more.hidden = false; more.textContent = 'Reîncarcă răspunsurile'; throw result.error; }
      for (const reply of result.data) { const thread = threads.get(reply.parent_id); if (thread) thread.replies.append(renderPost(reply, thread.post)); }
      offset += result.data.length; more.hidden = offset >= result.count || !result.data.length; more.textContent = 'Mai multe răspunsuri';
    }
    try { await loadReplyBatch(); } catch (_) { toast('Răspunsurile nu au putut fi încărcate. Folosește „Reîncarcă răspunsurile”.'); }
  }
  async function moderatePost(id, status) {
    const { error } = await client.from('bg3ro_discussion_posts').update({ status }).eq('id', id);
    if (error) throw error; await loadComments();
  }
  function cancelReply() { $('#discussion-form').elements.parent_id.value = ''; $('#reply-label').hidden = true; $('#cancel-reply').hidden = true; $('#discussion-title').value = ''; }
  $('#cancel-reply').addEventListener('click', cancelReply);
  $('#previous-comments').addEventListener('click', async () => { page = Math.max(0, page - 1); await loadComments(); });
  $('#next-comments').addEventListener('click', async () => { page++; await loadComments(); });
  $('#discussion-form').addEventListener('submit', event => {
    event.preventDefault(); if (!client || !user) return;
    submit(event.currentTarget, async () => {
      const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
      const { error } = await client.from('bg3ro_discussion_posts').insert({ author_id: user.id, author_name: values.author_name.trim(), title: values.title.trim(), body: values.body.trim(), parent_id: values.parent_id || null });
      if (error) throw error;
      form.elements.body.value = ''; cancelReply(); formStatus(form, 'Mesajul a fost publicat.'); if (!values.parent_id) page = 0; await loadComments();
    });
  });
  $('#report-form').addEventListener('submit', event => {
    event.preventDefault(); if (!client || !user) return;
    submit(event.currentTarget, async () => {
      const form = event.currentTarget, values = Object.fromEntries(new FormData(form)); delete values.website; delete values.public_consent;
      Object.keys(values).forEach(key => { values[key] = values[key].trim(); });
      await window.BG3RO_REPORT_PHOTO.publish(client, { ...values, author_id: user.id, is_public: true });
      form.reset(); formStatus(form, 'Raportarea a fost trimisă și este publică. O poți urmări mai jos.'); await loadReports();
    });
  });
  async function loadReports() {
    const request = ++reportsRequest;
    if (!client) return;
    const target = $('#reports-list');
    const { data, count, error } = await client.from('bg3ro_bug_reports').select('id,title,body,category,platform,mod_version,game_version,status,moderator_reply,created_at,is_public,author_name,is_guest,screenshot_path', { count: 'exact' }).order('created_at', { ascending: false }).limit(reportsLimit);
    if (request !== reportsRequest) return;
    if (error) { target.replaceChildren(element('p', 'small', 'Raportările nu au putut fi încărcate.')); return; }
    target.replaceChildren(); $('#more-reports').hidden = reportsLimit >= count;
    if (!data.length) target.append(element('p', 'small', 'Nu a fost raportată nicio eroare.'));
    data.forEach(report => {
      const article = element('article', 'report-item');
      article.append(element('p', 'small', `${report.author_name || 'Jucător'} · ${report.is_guest ? 'Oaspete · ' : ''}${report.is_public ? 'Raportare publică' : 'Raportare privată — vizibilă doar autorului și moderatorului'}`));
      article.append(element('span', 'post-status', statusLabels[report.status]), element('h3', '', report.title), element('p', 'small', `${dateText(report.created_at)} · ${report.platform} · ${report.mod_version}`), element('p', '', report.body));
      if (report.moderator_reply) article.append(element('strong', '', 'Răspunsul proiectului'), element('p', '', report.moderator_reply));
      if (moderator) {
        const form = element('form'); const field = element('div', 'field');
        const label = element('label', '', 'Stadiul raportării'); label.htmlFor = `state-${report.id}`;
        const select = element('select'); select.name = 'status'; select.id = label.htmlFor;
        ['new','investigating','resolved','closed'].forEach(value => { const option = element('option', '', statusLabels[value]); option.value = value; option.selected = report.status === value; select.append(option); });
        field.append(label, select);
        const replyField = element('div', 'field'), replyLabel = element('label', '', report.is_public ? 'Răspuns public' : 'Răspuns privat pentru autor'), textarea = element('textarea');
        textarea.name = 'reply'; textarea.id = `answer-${report.id}`; replyLabel.htmlFor = textarea.id; textarea.maxLength = 4000; textarea.value = report.moderator_reply || ''; replyField.append(replyLabel, textarea);
        const button = element('button', 'btn secondary small-btn', 'Salvează răspunsul'); button.type = 'submit';
        buttonIcon(button, ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z','M7 3v6h10V3M7 21v-8h10v8']);
        const actions = element('div', 'report-actions'); actions.append(button);
        form.append(field, replyField, actions, element('p', 'form-status')); form.querySelector('.form-status').setAttribute('role', 'status');
        form.addEventListener('submit', event => { event.preventDefault(); submit(form, async () => {
          const { error: updateError } = await client.from('bg3ro_bug_reports').update({ status: select.value, moderator_reply: textarea.value.trim() }).eq('id', report.id);
          if (updateError) throw updateError; toast('Raportare actualizată.'); await loadReports();
        }); }); article.append(form);
        const remove = actionButton('Șterge raportarea', async () => {
          if (!confirm('Ștergi definitiv această raportare?')) return;
          const result = await client.from('bg3ro_bug_reports').delete().eq('id', report.id);
          if (result.error) throw result.error;
          await window.BG3RO_REPORT_PHOTO.cleanup(client, report.screenshot_path);
          await loadReports();
        });
        buttonIcon(remove, ['M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14','M10 10v6m4-6v6']);
        actions.append(remove);
      }
      target.append(article);
      window.BG3RO_REPORT_PHOTO.show(client, report, article).catch(() => {});
    });
  }
  $('#more-reports').addEventListener('click', async () => { reportsLimit += 20; await loadReports(); });
  $('#update-form').addEventListener('submit', event => {
    event.preventDefault(); if (!client || !moderator) return;
    submit(event.currentTarget, async () => {
      const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
      const { error } = await client.from('bg3ro_project_updates').insert({ title: values.title.trim(), body: values.body.trim(), author_id: user.id });
      if (error) throw error; form.reset(); formStatus(form, 'Actualizare publicată.'); await loadUpdates();
    });
  });
  $('#progress-form').addEventListener('submit', event => {
    event.preventDefault(); if (!client || !moderator) return;
    submit(event.currentTarget, async () => {
      const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
      for (const field of ['translation_percent','review_percent','testing_percent']) values[field] = Number(values[field]);
      const { data, error } = await client.from('bg3ro_project_status').update(values).eq('id', 1).select('translation_percent,review_percent,testing_percent').maybeSingle();
      if (error || !data) throw error || new Error('Progress not saved'); formStatus(form, 'Progres actualizat.'); await loadProgress();
    });
  });
  async function initialize() {
    if (configured) {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.118.0');
        client = createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { flowType: 'pkce', storage: window.BG3RO_AUTH_STORAGE || sessionStorage, storageKey: 'bg3ro-auth', persistSession: true, detectSessionInUrl: false, autoRefreshToken: true } });
        const schema = await client.from('bg3ro_project_status').select('id').eq('id', 1).maybeSingle();
        if (schema.error || !schema.data) throw new Error('Community schema is not ready');
        let callbackFailed = authError;
        if (authCode && authEnabled) {
          const result = await client.auth.exchangeCodeForSession(authCode);
          callbackFailed = !!result.error;
        }
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        client.auth.onAuthStateChange((_event, session) => { setTimeout(() => sessionChanged(session).then(loadUpdates).catch(() => toast('Comunitatea nu a putut fi actualizată.')), 0); });
        await sessionChanged(data.session);
        if (authCode || authError) {
          const returnTab = sessionStorage.getItem('bg3ro-return-tab');
          sessionStorage.removeItem('bg3ro-return-tab');
          if (routeIds.includes(returnTab)) { history.replaceState(null, '', location.pathname + location.search + '#' + returnTab); setTab(returnTab); $('.tab-list').scrollIntoView({ block: 'start' }); }
          if (callbackFailed || !data.session) {
            $('#auth-unavailable').hidden = true; $('#discord-login-form').hidden = false;
            discordConsentRequired = true;
            formStatus($('#discord-login-form'), 'Conectarea Discord a fost anulată sau a expirat. Încearcă din nou din acest browser; dacă este nevoie, Discord îți va cere autorizarea.', true); dialog.showModal();
          } else toast('Ești conectat prin Discord. Poți participa la comunitate.');
        }
      } catch (_error) { client = null; }
    }
    if (!client) {
      $$('.backend-notice').forEach(notice => { notice.hidden = false; });
      $$('[data-auth-open]').forEach(button => { button.textContent = button.dataset.authLabel || 'Comunitate în pregătire'; });
    }
    if (client && !authEnabled) {
      $$('[data-auth-open]').forEach(button => { button.textContent = button.dataset.authLabel || 'Comunitate în pregătire'; });
      $$('.backend-notice').forEach(notice => {
        notice.hidden = false;
        notice.textContent = 'Autentificarea este temporar dezactivată. Mesajele și raportările vor putea fi trimise după reactivare.';
      });
    }
    syncAuth(); await Promise.all([loadUpdates(), loadComments(), loadReports(), loadProgress()]);
    document.documentElement.classList.add('portal-ready');
  }
  initialize().catch(() => { document.documentElement.classList.add('portal-ready'); toast('Conexiunea la comunitate nu a reușit. Conținutul proiectului rămâne disponibil.'); });
})();
