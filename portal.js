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
  const discussionsPerPage = 10;
  const requestedPage=Number(new URL(location.href).searchParams.get('pagina'));
  if(Number.isInteger(requestedPage)&&requestedPage>0&&requestedPage<=10000)page=requestedPage-1;
  let replyName='';
  let replyContext=null;
  function parkComposer() {
    const form=$('#reply-discussion-form');
    if(form){$('#discussion-reply-home').append(form);form.hidden=true;}
  }
  function discussionIcon(type){
    // Lucide icons (ISC/MIT); see assets/lucide-LICENSE.txt.
    const paths={reply:'m9 17-5-5 5-5M20 18v-2a4 4 0 0 0-4-4H4',quote:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 10h.01M12 10h.01M16 10h.01',link:'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',delete:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'};
    paths.approve='m5 12 4 4L19 6';paths.reject='M5 5l14 14M19 5 5 19';
    paths.edit='m16 3 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15l-1 6Z';
    paths.new='M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0';paths.investigating='M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2';paths.resolved=paths.new+'m-14-1 4 4 6-6';paths.closed=paths.new+'M9 9l6 6m0-6-6 6';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[type]);svg.append(path);return svg;
  }
  function discussionAction(label,icon,callback){const button=actionButton(label,callback);button.prepend(discussionIcon(icon));return button;}
  function bugIcon(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[k,v]of Object.entries({viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M8 7a4 4 0 0 1 8 0m-4 2v12m-5-11H3m18 0h-4M7 15H3m18 0h-4M7 6 4 3m13 3 3-3M7 19l-3 2m13-2 3 2M7 9h10v7a5 5 0 0 1-10 0Z');svg.append(path);return svg;}
  function attachReply(post, quote=false, focus=true) {
    if(!user||post.status!=='approved')return;
    const content=document.getElementById('post-'+post.id)?.querySelector('.post-content');if(!content)return;
    const form=$('#reply-discussion-form');if(!form)return;
    if(form.querySelector('[type=submit]').disabled)return;
    replyContext=post;replyName=post.author_name;
    form.elements.parent_id.value=post.parent_id||post.id;form.elements.title.value='Răspuns';
    const label=$('#reply-reply-label');label.hidden=false;label.replaceChildren(discussionIcon('reply'),document.createTextNode('Răspuns către: '),element('strong','','@'+post.author_name));
    const preview=window.BG3RO_DISCUSSION_EDITOR?.render(post.body).textContent||post.body;
    label.append(element('span','reply-excerpt',' „'+preview.slice(0,100)+(preview.length>100?'…':'')+'”'));
    $('#reply-cancel-reply').hidden=false;$('#reply-cancel-reply').textContent='Anulează';
    content.closest('.post').append(form);form.hidden=false;
    form.querySelector('[type=submit]').textContent='Răspunde';
    if(quote)window.BG3RO_REPLY_EDITOR?.quote(post.body,post.author_name);
    if(focus){form.scrollIntoView({block:'nearest',behavior:'instant'});window.BG3RO_REPLY_EDITOR?.focus();}
  }
  function drawDiscussionPages(count) {
    const total = Math.ceil(count / discussionsPerPage), numbers = $('#discussion-pages');
    numbers.replaceChildren();
    $('#discussion-pagination').hidden = !count;
    $('#previous-comments').hidden = false; $('#next-comments').hidden = false;
    $('#previous-comments').disabled = page === 0; $('#next-comments').disabled = page + 1 >= total;
    const shown = new Set([0, total - 1, page - 1, page, page + 1]);
    if (page < 2) [1,2].forEach(n => shown.add(n));
    if (page > total - 3) [total-3,total-2].forEach(n => shown.add(n));
    let last = -1;
    [...shown].filter(n=>n>=0&&n<total).sort((a,b)=>a-b).forEach(n=>{
      if(last>=0&&n-last>1) numbers.append(element('span','page-ellipsis','…'));
      const button=element('button','discussion-page',String(n+1));button.type='button';
      button.setAttribute('aria-label',`Pagina ${n+1}`);
      if(n===page) button.setAttribute('aria-current','page');
      button.addEventListener('click',()=>changeDiscussionPage(n));numbers.append(button);last=n;
    });
    $('#comments-page').textContent = `Se afișează ${page*discussionsPerPage+1}–${Math.min((page+1)*discussionsPerPage,count)} din ${count} ${count===1?'discuție':'discuții'}`;
  }
  async function changeDiscussionPage(next) {
    page=Math.max(0,next);await loadComments();
    $('#discussion-list').scrollIntoView({block:'start',behavior:'instant'});
    $('#discussion-pages [aria-current=page]')?.focus({preventScroll:true});
  }
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
  function emptyState(title, description) {
    const empty = element('div', 'empty-state');
    empty.append(element('h3', '', title), element('p', 'small', description));
    return empty;
  }
  function toast(message) {
    clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6500);
  }
  function formStatus(form, message, error = false) {
    const target = form.querySelector('.form-status'); target.textContent = message; target.classList.toggle('error', error);
  }
  function readableError(error) {
    if (error?.code === 'REPORT_PHOTO' || error?.code === 'MANUAL_UPDATE' || error?.code === 'DISCUSSION_EDITOR') return error.message;
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
  function tabCount(selector, label, count) {
    $(selector).textContent = Number.isSafeInteger(count) && count > 0 ? `${label} (${count})` : label;
  }
  let guestStarting = false;
  let guestSessionPromise = null;
  // Restore a saved identity first and share one in-flight anonymous sign-in.
  async function ensureGuestSession() {
    if (!client || !authEnabled || user) return;
    if (!guestSessionPromise) guestSessionPromise = (async () => {
      const {data: restored, error: restoreError} = await client.auth.getSession();
      if (restoreError) throw restoreError;
      let session = restored.session;
      if (!session) {
        const {data, error} = await client.auth.signInAnonymously();
        if (error || !data.session) throw error || new Error('Guest session unavailable');
        session = data.session;
      }
      if (!user || user.is_anonymous) await sessionChanged(session);
    })().finally(() => { guestSessionPromise = null; });
    return guestSessionPromise;
  }
  function discordName() {
    const metadata = user?.user_metadata || {};
    const name = String(metadata.preferred_username || metadata.user_name || metadata.full_name || metadata.name || 'Jucător Discord').replace(/[\u0000-\u001f]/g, '').trim().slice(0,40);
    return name.includes('@') || name.length < 2 ? 'Jucător Discord' : name;
  }
  function syncAuth() {
    const member = !!user && !user.is_anonymous;
    $('#discussion-name').readOnly = member;
    if (member) $('#discussion-name').value = discordName();
    const ownAvatar=$('#discussion-avatar');
    const avatarURL=user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';
    ownAvatar.src=member && /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(avatars\/[0-9]+\/[A-Za-z0-9_]+\.(png|jpg|jpeg|webp|gif)|embed\/avatars\/[0-9]+\.png)(\?size=[0-9]+)?$/.test(avatarURL) ? avatarURL : './assets/discussion-avatar.svg';
    ownAvatar.classList.toggle('post-avatar-default',ownAvatar.src.endsWith('discussion-avatar.svg'));
    $('#discussion-name').closest('.field').hidden=member;
    if($('#reply-discussion-form')){
      $('#reply-discussion-form').hidden=!user || !replyContext;
    }
    $('#discussion-own-name').hidden=!member;$('#discussion-own-name').textContent=member?discordName():'';
    ownAvatar.onerror=()=>{ownAvatar.onerror=null;ownAvatar.src='./assets/discussion-avatar.svg';ownAvatar.classList.add('post-avatar-default');};
    $('#report-name').closest('.field').hidden = member;
    $('#report-name').disabled = member;
    $$('[data-auth-gate]').forEach(gate => { gate.hidden = !!user || !client || !authEnabled; });
    $$('[data-user-form]').forEach(form => { form.hidden = !user; });
    $$('[data-auth-open]').forEach(button => { button.hidden = member; });
    $('#sign-out').hidden = !member;
    $('#sign-out').textContent = 'Deconectare';
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
    $('#discussion-form button[type="submit"]').textContent = 'Trimite';
    $('#discord-login').disabled = !client || !authEnabled;
    $$('[data-guest-start]').forEach(button => { button.disabled = guestStarting || !client || !authEnabled; });
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
    if (!client || !authEnabled || button.disabled || guestStarting) return;
    const destination = button.dataset.guestStart === 'auto' ? (location.hash === '#erori' ? 'report' : 'discussion') : button.dataset.guestStart;
    guestStarting = true; $$('[data-guest-start]').forEach(el => { el.disabled = true; });
    try {
      await ensureGuestSession();
      if (dialog.open) dialog.close();
      goTab(destination === 'report' ? 'erori' : 'discutii');
      $('#'+destination+'-name').focus();
    } catch (_) { toast('Modul oaspete nu a putut fi pornit. Încearcă din nou sau conectează-te cu Discord.'); }
    finally { guestStarting = false; $$('[data-guest-start]').forEach(el => { el.disabled = !client || !authEnabled; }); }
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
    $('#discussion-form').reset(); $('#reply-discussion-form')?.reset(); $('#report-form').reset(); cancelReply();
    await ensureGuestSession().catch(() => toast('Accesul ca oaspete nu este disponibil momentan. Poți reîncerca din formular.'));
    await Promise.all([loadComments(), loadReports(), loadUpdates()]); toast('Te-ai deconectat.');
  });
  async function sessionChanged(session) {
    user = session?.user || null; moderator = false;
    if (user && !user.is_anonymous) {
      try { localStorage.setItem('bg3ro-discord-authorized', '1'); } catch (_) {}
      const { data, error } = await client.rpc('bg3ro_is_moderator');
      if (!error) moderator = data === true;
      if (!$('#report-name').value) $('#report-name').value = String(user.user_metadata?.full_name || user.user_metadata?.name || '').slice(0, 40);
    }
    if (user && !user.is_anonymous && dialog.open) dialog.close();
    syncAuth(); await Promise.all([loadComments(), loadReports(), loadProgress(), loadUpdates()]);
  }
  async function loadProgress() {
    if (!client) return;
    const { data, error } = await client.from('bg3ro_project_status').select('translation_percent,review_percent,testing_percent,work_title,work_body').eq('id', 1).maybeSingle();
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
    for (const field of ['title','body']) {
      const output = $(`#current-work-${field}`), value = data[`work_${field}`];
      if (typeof value === 'string') output.textContent = value;
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
      const { data, error } = await client.from('bg3ro_project_status').update(values).eq('id', 1).select('work_title,work_body').maybeSingle();
      if (error || !data) throw error || new Error('Work section not saved');
      workDirty = false; await loadProgress(); formStatus(form, 'Secțiunea a fost salvată.');
    });
  });
  let updatesRequest = 0;
  async function loadUpdates() {
    const ticket = ++updatesRequest;
    const target = document.createElement('div');
    if (!client) { window.BG3RO_NEWS.commit('manual', []); return; }
    const { data, error } = await client.from('bg3ro_project_updates').select('id,author_id,author_name,author_avatar_url,title,body,published_at,link_url,link_label,badge_label').order('published_at', { ascending: false }).limit(30);
    if (ticket !== updatesRequest) return;
    if (error) { target.append(element('p', 'card small', 'Actualizările nu au putut fi încărcate.')); }
    else window.BG3RO_UPDATES.render(client, data, target, moderator, user?.id, loadUpdates);
    window.BG3RO_NEWS.commit('manual', [...target.children]);
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
    // Never discard the live ProseMirror instance when refreshing its parent thread.
    if($('#reply-discussion-form')?.closest('#discussion-list'))parkComposer();
    if (!client) { target.replaceChildren(element('p', 'small', 'Discuțiile vor apărea aici după conectarea comunității.')); return; }
    const fields = 'id,author_id,author_name,title,body,status,parent_id,created_at,is_guest,author_avatar_url';
    const { data, count, error } = await client.from('bg3ro_discussion_posts').select(fields, { count: 'exact' }).is('parent_id', null).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * discussionsPerPage, page * discussionsPerPage + discussionsPerPage - 1);
    if (ticket !== commentsRequest) return;
    if (error) { target.replaceChildren(element('p', 'small', 'Discuțiile nu au putut fi încărcate. Încearcă din nou mai târziu.')); return; }
    if (!data.length && page > 0) { page=Math.max(0,Math.ceil((count||0)/discussionsPerPage)-1); return loadComments(); }
    if($('#reply-discussion-form')?.closest('#discussion-list'))parkComposer();
    target.replaceChildren(); tabCount('#tab-discutii', 'Discuții', count);
    drawDiscussionPages(count || 0);
    if (!data.length) target.append(emptyState('Deschide conversația', 'Nu sunt încă mesaje publicate. Poți fi primul care lasă o întrebare sau o sugestie.'));
    const threads = new Map(), renderedPosts = new Map();
    function renderPost(post, parent) {
      renderedPosts.set(post.id,post);
      const article = element('article', parent ? 'post reply' : 'post'); article.id = `post-${post.id}`;
      const avatar = element('img', 'post-avatar');
      const remote = !post.is_guest && /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(avatars\/[0-9]+\/[A-Za-z0-9_]+\.(png|jpg|jpeg|webp|gif)|embed\/avatars\/[0-9]+\.png)(\?size=[0-9]+)?$/.test(post.author_avatar_url || '');
      avatar.src = remote ? post.author_avatar_url : './assets/discussion-avatar.svg';
      avatar.classList.toggle('post-avatar-default', !remote); avatar.alt = ''; avatar.width = 44; avatar.height = 44; avatar.loading = 'lazy'; avatar.referrerPolicy = 'no-referrer';
      if (remote) avatar.addEventListener('error', () => { avatar.classList.add('post-avatar-default'); avatar.src = './assets/discussion-avatar.svg'; }, { once: true });
      const content = element('div', 'post-content');
      const meta = element('div', 'post-meta'); meta.append(element('strong', '', post.author_name), element('time', '', dateText(post.created_at)));
      meta.querySelector('time').dateTime = post.created_at;
      if (post.is_guest) meta.append(element('span', 'post-status', 'Oaspete'));
      if (post.status !== 'approved') meta.append(element('span', 'post-status', statusLabels[post.status]));
      content.append(meta);
      if (parent && !window.BG3RO_DISCUSSION_EDITOR?.hasMention(post.body)) content.append(element('p', 'post-mention', `@${parent.author_name}`));
      content.append(window.BG3RO_DISCUSSION_EDITOR ? window.BG3RO_DISCUSSION_EDITOR.render(post.body) : element('div','post-body',post.body));
      if(post.status==='approved')window.BG3RO_REACTIONS?.mount(content,post.id);
      const actions = element('div', 'post-actions');
      if (user && post.status === 'approved') {
        actions.append(discussionAction('Răspunde','reply', () => attachReply(post)));
        actions.append(discussionAction('Citat','quote',()=>attachReply(post,true)));
      }
      actions.append(discussionAction('Link','link',async()=>{
        const url=new URL(location.href);url.hash='discutii';url.searchParams.set('discutie',post.parent_id||post.id);url.searchParams.set('pagina',String(page+1));
        try{await navigator.clipboard.writeText(url.href);toast('Linkul discuției a fost copiat.');}catch(_){toast('Linkul nu a putut fi copiat.');}
      }));
      if (moderator && post.status !== 'approved') actions.append(discussionAction('Aprobă','approve', () => moderatePost(post.id, 'approved')));
      if (moderator && post.status !== 'rejected') actions.append(discussionAction('Nu publica','reject', () => moderatePost(post.id, 'rejected')));
      if (moderator || post.author_id === user?.id) actions.append(discussionAction('Șterge','delete', async () => {
        if (!confirm('Ștergi mesajul și răspunsurile asociate? Acțiunea nu poate fi anulată din site.')) return;
        const { error: deletionError } = await client.from('bg3ro_discussion_posts').delete().eq('id', post.id);
        if (deletionError) throw deletionError; await loadComments();
      }));
      if (actions.children.length) content.append(actions);
      article.append(avatar, content); return article;
    }
    data.forEach(post => {
      const thread = element('section', 'post-thread'), replies = element('div', 'post-replies');
      thread.setAttribute('aria-label', `Discuție de ${post.author_name}`); replies.setAttribute('aria-label', `Răspunsuri pentru ${post.author_name}`);
      thread.append(renderPost(post), replies); target.append(thread); threads.set(post.id, { post, replies });
    });
    window.BG3RO_REACTIONS?.load(data.map(post=>post.id));
    window.BG3RO_POLLS?.load(data.map(post=>post.id));
    if (!data.length) { if(replyContext)cancelReply();return; }
    let offset = 0;
    const more = actionButton('Mai multe răspunsuri', loadReplyBatch); more.classList.add('replies-more'); more.hidden = true; target.append(more);
    async function loadReplyBatch() {
      const result = await client.from('bg3ro_discussion_posts').select(fields, { count: 'exact' }).in('parent_id', data.map(post => post.id)).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 99);
      if (ticket !== commentsRequest) return;
      if (result.error) { more.hidden = false; more.textContent = 'Reîncarcă răspunsurile'; throw result.error; }
      for (const reply of result.data) { const thread = threads.get(reply.parent_id); if (thread) thread.replies.append(renderPost(reply, thread.post)); }
      window.BG3RO_REACTIONS?.load(result.data.map(reply=>reply.id));
      offset += result.data.length; more.hidden = offset >= result.count || !result.data.length; more.textContent = 'Mai multe răspunsuri';
    }
    try { await loadReplyBatch(); } catch (_) { toast('Răspunsurile nu au putut fi încărcate. Folosește „Reîncarcă răspunsurile”.'); }
    if(replyContext){
      const latest=renderedPosts.get(replyContext.id);
      if(latest?.status==='approved'&&user)attachReply(latest,false,false);
      else {cancelReply();toast('Comentariul nu mai este pe această pagină. Textul tău a fost păstrat în editor.');}
    }
    const linked=new URL(location.href).searchParams.get('discutie');
    if(linked&&location.hash==='#discutii')document.getElementById('post-'+linked)?.scrollIntoView({block:'center',behavior:'instant'});
  }
  async function moderatePost(id, status) {
    const { error } = await client.from('bg3ro_discussion_posts').update({ status }).eq('id', id);
    if (error) throw error; await loadComments();
  }
  function cancelReply() {
    parkComposer();replyContext=null;replyName='';
    const form=$('#reply-discussion-form');if(form){form.elements.parent_id.value='';form.elements.body.value='';}
    window.BG3RO_REPLY_EDITOR?.reset();
    const label=$('#reply-reply-label');if(label){label.replaceChildren();label.hidden=true;}
  }
  $('#reply-cancel-reply')?.addEventListener('click', ()=>{if(!$('#reply-discussion-form [type=submit]').disabled)cancelReply();});
  $('#previous-comments').addEventListener('click', () => changeDiscussionPage(page - 1));
  $('#next-comments').addEventListener('click', () => changeDiscussionPage(page + 1));
  for(const form of [$('#discussion-form'),$('#reply-discussion-form')].filter(Boolean))form.addEventListener('submit', event => {
    event.preventDefault(); if (!client || !user) return;
    const nameInput=$('#discussion-name');
    if(user.is_anonymous){nameInput.value=nameInput.value.trim();if(!nameInput.reportValidity()){nameInput.scrollIntoView({block:'center',behavior:'instant'});nameInput.focus();return;}}
    submit(form, async () => {
      const values = Object.fromEntries(new FormData(form));
      let body=values.body.trim();
      let poll=null;
      try{if(!values.parent_id)poll=window.BG3RO_POLLS?.value();}catch(error){error.code='DISCUSSION_EDITOR';throw error;}
      const editor=form.id==='discussion-form'?window.BG3RO_DISCUSSION_EDITOR:window.BG3RO_REPLY_EDITOR;
      try { if(poll && !editor?.editor?.getText().trim())body='Sondaj: '+poll.question;else if(editor)body=editor.value(values.parent_id?replyName:''); }
      catch(error){error.code='DISCUSSION_EDITOR';throw error;}
      const authorName=user.is_anonymous ? nameInput.value.trim() : discordName();
      const { error } = poll ? await client.rpc('bg3ro_publish_poll',{p_name:authorName,p_body:body,p_question:poll.question,p_options:poll.options,p_multiple:poll.multiple}) : await client.from('bg3ro_discussion_posts').insert({ author_id: user.id, author_name:authorName, title: values.parent_id ? 'Răspuns' : 'Comentariu', body, parent_id: values.parent_id || null });
      if (error) throw error;
      form.elements.body.value = '';editor?.clear();if(poll)window.BG3RO_POLLS.clear();if(values.parent_id)cancelReply();formStatus(form,'');if (!values.parent_id) page = 0;await loadComments();
    });
  });
  $('#report-form').addEventListener('submit', event => {
    event.preventDefault(); if (!client || !user) return;
    submit(event.currentTarget, async () => {
      const form = event.currentTarget, values = Object.fromEntries(new FormData(form)); delete values.website; delete values.public_consent;
      Object.keys(values).forEach(key => { values[key] = values[key].trim(); });
      if (!user.is_anonymous) {
        values.author_name = discordName();
      }
      try{if(window.BG3RO_REPORT_EDITOR)values.body=window.BG3RO_REPORT_EDITOR.value();}catch(error){error.code='DISCUSSION_EDITOR';throw error;}
      const description=window.BG3RO_REPORT_EDITOR?.editor?.getText().trim()||values.body;
      values.title=description.replace(/\s+/g,' ').slice(0,120);
      values.mod_version=values.mod_version||'Nespecificată';
      await window.BG3RO_REPORT_PHOTO.publish(client, { ...values, author_id: user.id, is_public: true });
      form.reset(); formStatus(form, ''); await loadReports();
    });
  });
  const reportReplyEditors=new Set();let openedReportState=null;
  function closeReportState(){const opened=openedReportState;openedReportState=null;if(opened?.menu.matches(':popover-open'))opened.menu.hidePopover();opened?.button.setAttribute('aria-expanded','false');}
  function placeReportState(){
    const opened=openedReportState;if(!opened)return;
    if(!opened.button.isConnected||!opened.menu.matches(':popover-open')){closeReportState();return;}
    const r=opened.button.getBoundingClientRect(),m=opened.menu.getBoundingClientRect();
    if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth){closeReportState();return;}
    opened.menu.style.left=Math.max(12,Math.min(r.left,innerWidth-m.width-12))+'px';
    opened.menu.style.top=Math.max(12,Math.min(r.top>m.height+16?r.top-m.height-8:r.bottom+8,innerHeight-m.height-12))+'px';
  }
  addEventListener('scroll',placeReportState,{capture:true,passive:true});addEventListener('resize',placeReportState);
  async function loadReports() {
    const request = ++reportsRequest;
    if (!client) return;
    const target = $('#reports-list');
    const { data, count, error } = await client.from('bg3ro_bug_reports').select('id,title,body,category,platform,mod_version,game_version,status,moderator_reply,created_at,is_public,author_name,is_guest,screenshot_path,screenshot_paths,author_avatar_url'+(user?',author_id':''), { count: 'exact' }).order('created_at', { ascending: false }).limit(reportsLimit);
    if (request !== reportsRequest) return;
    if (error) { target.replaceChildren(element('p', 'small', 'Raportările nu au putut fi încărcate.')); return; }
    closeReportState();for(const api of reportReplyEditors)api.destroy();reportReplyEditors.clear();
    target.replaceChildren(); tabCount('#tab-erori', 'Raportare erori', count); $('#more-reports').hidden = reportsLimit >= count;
    if (!data.length) {const empty=element('div','report-empty');empty.append(bugIcon(),element('p','','Nu a fost raportată încă nicio eroare.'));target.append(empty);}
    data.forEach(report => {
      const article = element('article', 'report-item post-thread');
      const layout = element('div', 'post'), content = element('div', 'post-content');
      const avatar = element('img', 'post-avatar');
      const remote = !report.is_guest && /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(avatars\/[0-9]+\/[A-Za-z0-9_]+\.(png|jpg|jpeg|webp|gif)|embed\/avatars\/[0-9]+\.png)(\?size=[0-9]+)?$/.test(report.author_avatar_url || '');
      avatar.src = remote ? report.author_avatar_url : './assets/discussion-avatar.svg';
      avatar.classList.toggle('post-avatar-default', !remote); avatar.alt = ''; avatar.width = 44; avatar.height = 44; avatar.loading = 'lazy'; avatar.referrerPolicy = 'no-referrer';
      if (remote) avatar.addEventListener('error', () => { avatar.classList.add('post-avatar-default'); avatar.src = './assets/discussion-avatar.svg'; }, { once: true });
      const header = element('div', 'report-header'), copy = element('div', 'post-meta');
      const date = element('time', '', dateText(report.created_at)); date.dateTime = report.created_at;
      copy.append(element('strong', '', report.author_name || 'Jucător'), date);
      if (report.is_guest) copy.append(element('span', 'post-status', 'Oaspete'));
      if (!report.is_public) copy.append(element('span', 'post-status', 'Privată'));
      const stateBadge=element('span', 'post-status report-state-badge', statusLabels[report.status]);stateBadge.dataset.state=report.status;copy.append(stateBadge);
      header.append(copy); content.append(header); layout.append(avatar, content); article.append(layout);
      const title = element('h3', 'post-title report-title-row');
      title.append(element('span', '', report.title), element('span', 'report-platform-version', ` · ${report.platform} · ${window.BG3RO_VERSIONS.version(report.mod_version)}`));
      const reportBody=window.BG3RO_REPORT_EDITOR?window.BG3RO_REPORT_EDITOR.render(report.body):element('div','post-body',report.body);reportBody.classList.add('report-body');
      if(!reportBody.textContent.replace(/\s+/g,' ').startsWith(report.title))content.append(title);
      content.append(reportBody);
      if (report.moderator_reply){const answer=window.BG3RO_REPORT_EDITOR?window.BG3RO_REPORT_EDITOR.render(report.moderator_reply):element('p','',report.moderator_reply);answer.classList.add('report-project-reply');content.append(element('strong', '', 'Răspunsul proiectului'),answer);}
      if (moderator || (user && report.author_id===user.id)) {
        const toolbar=element('div','report-toolbar post-actions');let inlineEdit=null;
        const edit=discussionAction('Editează','edit',()=>{
          if(inlineEdit){inlineEdit.api.focus();return;}
          inlineEdit=window.BG3RO_CREATE_REPORT_REPLY?.(layout,report.body,true);if(!inlineEdit)return;
          const {form,api,cancel}=inlineEdit;reportReplyEditors.add(api);form.querySelector('[type=submit]').textContent='Salvează modificările';
          cancel.addEventListener('click',()=>{if(form.querySelector('[type=submit]').disabled)return;api.destroy();reportReplyEditors.delete(api);form.remove();inlineEdit=null;edit.focus({preventScroll:true});});
          form.addEventListener('submit',event=>{event.preventDefault();submit(form,async()=>{
            if(!moderator&&report.author_id!==user?.id)return;
            let body;try{body=api.value();}catch(error){error.code='DISCUSSION_EDITOR';throw error;}
            const title=api.editor.getText().replace(/\s+/g,' ').trim().slice(0,120);
            const {error}=await client.from('bg3ro_bug_reports').update({title,body}).eq('id',report.id);if(error)throw error;await loadReports();
          });});form.scrollIntoView({block:'nearest',behavior:'instant'});api.focus();
        });edit.setAttribute('aria-label','Editează raportarea');
        const remove = actionButton('Șterge raportarea', async () => {
          if (!confirm('Ștergi definitiv această raportare?')) return;
          const result = await client.from('bg3ro_bug_reports').delete().eq('id', report.id);
          if (result.error) throw result.error;
          await window.BG3RO_REPORT_PHOTO.cleanup(client, report.screenshot_paths?.length?report.screenshot_paths:report.screenshot_path);
          await loadReports();
        });
        buttonIcon(remove, ['M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14','M10 10v6m4-6v6']);
        remove.setAttribute('aria-label', 'Șterge raportarea'); remove.title = 'Șterge raportarea';
        remove.replaceChildren(discussionIcon('delete'),document.createTextNode('Șterge'));
        if(moderator){
        let inlineReply=null;
        const reply=discussionAction(report.moderator_reply?'Editează răspunsul':'Răspunde','reply',()=>{
          if(inlineReply){inlineReply.api.focus();return;}
          inlineReply=window.BG3RO_CREATE_REPORT_REPLY?.(layout,report.moderator_reply||'');if(!inlineReply)return;
          const {form:replyForm,api,cancel}=inlineReply;reportReplyEditors.add(api);
          replyForm.querySelector('[type=submit]').textContent=report.moderator_reply?'Salvează răspunsul':'Răspunde';
          const close=()=>{api.destroy();reportReplyEditors.delete(api);replyForm.remove();inlineReply=null;reply.focus({preventScroll:true});};
          cancel.addEventListener('click',()=>{if(!replyForm.querySelector('[type=submit]').disabled)close();});
          replyForm.addEventListener('submit',event=>{event.preventDefault();submit(replyForm,async()=>{
            if(!moderator)return;
            let body;try{body=api.value();}catch(error){error.code='DISCUSSION_EDITOR';throw error;}
            const {error}=await client.from('bg3ro_bug_reports').update({moderator_reply:body}).eq('id',report.id);
            if(error)throw error;await loadReports();
          });});
          replyForm.scrollIntoView({block:'nearest',behavior:'instant'});api.focus();
        });
        const menu=element('div','report-state-menu');menu.id='report-states-'+report.id;menu.setAttribute('popover','auto');menu.setAttribute('role','menu');menu.setAttribute('aria-label','Stadiul raportării');
        const status=element('span','report-state-status');status.setAttribute('role','status');
        const stateButton=discussionAction('Stare: '+statusLabels[report.status],report.status,()=>{
          if(menu.matches(':popover-open')){closeReportState();return;}
          closeReportState();menu.showPopover();openedReportState={menu,button:stateButton};stateButton.setAttribute('aria-expanded','true');placeReportState();menu.querySelector('[aria-checked=true]')?.focus({preventScroll:true});
        });stateButton.classList.add('report-state-trigger');stateButton.dataset.state=report.status;stateButton.setAttribute('popovertarget',menu.id);stateButton.addEventListener('click',event=>event.preventDefault());stateButton.setAttribute('aria-haspopup','menu');stateButton.setAttribute('aria-controls',menu.id);stateButton.setAttribute('aria-expanded','false');
        for(const value of ['new','investigating','resolved','closed']){const option=element('button','report-state-option');option.append(discussionIcon(value),element('span','visually-hidden',statusLabels[value]));option.title=statusLabels[value];option.type='button';option.dataset.state=value;option.setAttribute('role','menuitemradio');option.setAttribute('aria-checked',String(value===report.status));option.addEventListener('click',async()=>{
          if(!moderator)return;menu.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='';
          try{const {error}=await client.from('bg3ro_bug_reports').update({status:value}).eq('id',report.id);if(error)throw error;report.status=value;stateBadge.textContent=statusLabels[value];stateBadge.dataset.state=value;stateButton.dataset.state=value;stateButton.replaceChildren(discussionIcon(value),document.createTextNode('Stare: '+statusLabels[value]));menu.querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.state===value)));closeReportState();stateButton.focus({preventScroll:true});}catch(error){status.textContent=readableError(error);}finally{menu.querySelectorAll('button').forEach(b=>b.disabled=false);}
        });menu.append(option);}
        menu.addEventListener('toggle',()=>{const open=menu.matches(':popover-open');stateButton.setAttribute('aria-expanded',String(open));if(!open&&openedReportState?.menu===menu)openedReportState=null;});
        menu.addEventListener('keydown',event=>{const options=[...menu.querySelectorAll('button')],i=options.indexOf(document.activeElement);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();options[event.key==='Home'?0:event.key==='End'?3:(i+(['ArrowLeft','ArrowUp'].includes(event.key)?3:1))%4].focus();}else if(event.key==='Escape'||event.key==='Tab'){if(event.key==='Escape')event.preventDefault();menu.hidePopover();stateButton.focus({preventScroll:true});}});
        toolbar.append(reply,stateButton,menu,status);
        }
        toolbar.append(edit,remove);content.append(toolbar);
      }
      target.append(article);
      window.BG3RO_REPORT_PHOTO.show(client, report, content).catch(() => {});
    });
  }
  $('#more-reports').addEventListener('click', async () => { reportsLimit += 20; await loadReports(); });
  $('#update-form').addEventListener('submit', event => {
    event.preventDefault(); if (!client || !moderator) return;
    submit(event.currentTarget, async () => {
      const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
      const { error } = await client.from('bg3ro_project_updates').insert({ ...window.BG3RO_UPDATES.values(form), author_id: user.id });
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
        client.auth.onAuthStateChange((event, session) => {
          // getSession above already restores INITIAL_SESSION; do not replay a stale snapshot.
          if (event === 'INITIAL_SESSION') return;
          setTimeout(() => sessionChanged(session).then(() => event === 'SIGNED_OUT' ? ensureGuestSession() : null).then(loadUpdates).catch(() => toast('Comunitatea nu a putut fi actualizată.')), 0);
        });
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
        await ensureGuestSession().catch(() => toast('Accesul ca oaspete nu este disponibil momentan. Poți reîncerca din formular.'));
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
