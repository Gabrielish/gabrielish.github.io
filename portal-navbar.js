(() => {
  const header = document.querySelector('.topbar');
  const toggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('.main-navigation');
  const compact = matchMedia('(max-width:1100px)');
  const supportTrigger = header.querySelector('.nav-support');
  const supportDialog = document.getElementById('support-dialog');
  supportTrigger.setAttribute('aria-haspopup', 'dialog');
  supportTrigger.setAttribute('aria-controls', 'support-dialog');
  supportTrigger.addEventListener('click', event => {
    event.preventDefault();
    supportDialog.showModal();
    document.documentElement.classList.add('support-open');
  });
  supportDialog.querySelector('.support-close').addEventListener('click', () => supportDialog.close());
  supportDialog.addEventListener('click', event => {
    const rect = supportDialog.getBoundingClientRect();
    if (event.target === supportDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) supportDialog.close();
  });
  supportDialog.addEventListener('close', () => {
    document.documentElement.classList.remove('support-open');
    (compact.matches ? toggle : supportTrigger).focus({ preventScroll: true });
  });
  document.documentElement.classList.add('nav-enhanced');
  function close(focus = false) {
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Deschide meniul');
    if (focus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = !header.classList.contains('menu-open');
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Închide meniul' : 'Deschide meniul');
    if (open) nav.querySelector('a,button:not([hidden])')?.focus({ preventScroll: true });
  });
  header.addEventListener('click', e => { if (e.target.closest('a, [data-auth-open], #sign-out')) close(); });
  document.getElementById('auth-dialog').addEventListener('close', () => { if (compact.matches) toggle.focus({ preventScroll: true }); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && header.classList.contains('menu-open')) close(true); });
  document.addEventListener('click', e => { if (!header.contains(e.target)) close(); });
  matchMedia('(min-width:1101px)').addEventListener('change', () => close());
})();
