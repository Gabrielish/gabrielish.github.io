(() => {
  'use strict';
  const key = 'bg3ro-auth', temporary = window.sessionStorage;
  let persistent = temporary;
  try { const store = window.localStorage; store.setItem('bg3ro-storage-check', '1'); store.removeItem('bg3ro-storage-check'); persistent = store; } catch (_) {}
  function sessionOnly(value) {
    try { const data = JSON.parse(value); delete data.provider_token; delete data.provider_refresh_token; return JSON.stringify(data); } catch (_) { return value; }
  }
  // Preserve an existing session on upgrade; OAuth PKCE verifier stays tab-local.
  const old = temporary.getItem(key);
  if (old && !persistent.getItem(key)) {
    try { persistent.setItem(key, sessionOnly(old)); if (persistent !== temporary) temporary.removeItem(key); } catch (_) {}
  }
  window.BG3RO_AUTH_STORAGE = {
    getItem(name) { return name === key ? persistent.getItem(name) || temporary.getItem(name) : temporary.getItem(name); },
    setItem(name, value) {
      if (name !== key) { temporary.setItem(name, value); return; }
      const clean = sessionOnly(value);
      try { persistent.setItem(name, clean); if (persistent !== temporary) temporary.removeItem(name); }
      catch (_) { temporary.setItem(name, clean); }
    },
    removeItem(name) { if (name === key) { persistent.removeItem(name); window.BG3RO_NAV_STATE?.clear(); } temporary.removeItem(name); }
  };
})();
