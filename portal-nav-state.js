(() => {
  'use strict';
  // Presentation only: never cache roles, permissions, notification text or HTML.
  const key = 'bg3ro-nav-display';
  const read = (store, name) => { try { return JSON.parse(window[store].getItem(name)); } catch { return null; } };
  const sessionUser = () => (read('localStorage', 'bg3ro-auth') || read('sessionStorage', 'bg3ro-auth'))?.user;
  const number = value => Math.min(99999, Math.max(0, Math.trunc(Number(value) || 0)));
  function load(id) {
    if (!id) return null;
    const data = read('localStorage', key) || read('sessionStorage', key);
    if (data?.id === id) return {id, name: typeof data.name === 'string' ? data.name.slice(0, 40) : '', messages:number(data.messages), contacts:number(data.contacts), notifications:number(data.notifications)};
    try { const name = sessionStorage.getItem('bg3ro-nav-name:' + id); if (name) return {id,name:name.slice(0,40),messages:0,contacts:0,notifications:0}; } catch {}
    return null;
  }
  function save(id, changes) {
    if (!id) return;
    const data = {...(load(id) || {id,name:'',messages:0,contacts:0,notifications:0})};
    if (typeof changes.name === 'string' && changes.name.trim()) data.name = changes.name.slice(0,40);
    for (const field of ['messages','contacts','notifications']) if (field in changes) data[field] = number(changes[field]);
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {} }
  }
  function clear() { for (const store of ['localStorage','sessionStorage']) try { window[store].removeItem(key); } catch {} }
  const user = sessionUser(), initial = user && !user.is_anonymous ? load(user.id) : null;
  document.documentElement.classList.add('nav-enhanced');
  if (user && !user.is_anonymous && !initial?.name) document.documentElement.classList.add('auth-restoring');
  function restore() {
    if (!initial?.name) return;
    const tools = document.querySelector('.nav-account-tools');
    if (!tools) return;
    tools.hidden = false;
    for (const id of ['nav-private-messages','nav-notifications','nav-profile','sign-out']) document.getElementById(id).hidden = false;
    document.querySelector('.navbar-actions>[data-auth-open]').hidden = true;
    document.querySelector('#nav-profile span').textContent = initial.name;
    for (const [id, value, label] of [['nav-private-messages',initial.messages+initial.contacts,'Mesaje'],['nav-notifications',initial.notifications,'Notificări']]) {
      const link = document.getElementById(id), badge = link.querySelector('.nav-account-count');
      badge.hidden = !value; badge.textContent = value > 99 ? '99+' : String(value);
      link.setAttribute('aria-label',value ? label+' ('+value+' necitite)' : label);
    }
  }
  window.BG3RO_NAV_STATE = {load,save,clear,restore,initial};
  addEventListener('storage', event => { if (event.key === 'bg3ro-auth') { const next = sessionUser(); if (!next || next.is_anonymous || next.id !== user?.id) clear(); } });
})();
