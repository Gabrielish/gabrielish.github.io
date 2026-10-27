(() => {
  'use strict';
  const dialog = document.querySelector('#auth-dialog'), discord = document.querySelector('#discord-login-form');
  const config = window.BG3RO_CONFIG || {};
  let client, mode = 'login', busy = false, token = '', widget, guestResolve;
  const callbackURL = new URL(location.href);
  let recovery = callbackURL.searchParams.get('auth') === 'recovery' && callbackURL.searchParams.has('code');
  const body = document.createElement('div');
  body.id = 'email-auth';
  body.innerHTML = `<div class="auth-divider"><span>SAU CU E-MAIL</span></div>
    <form id="email-auth-form">
      <label class="field" data-signup>Nume utilizator<input name="username" autocomplete="username" minlength="2" maxlength="40"></label>
      <label class="field" data-email>E-mail<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
      <label class="field" data-password>Parolă<input name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128"></label>
      <label class="field" data-confirm>Confirmă parola<input name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128"></label>
      <label class="checkbox-line" data-signup><input name="consent" type="checkbox"><span>Am citit <a href="#confidentialitate">politica de confidențialitate</a>.</span></label>
      <div id="auth-captcha"></div><p class="form-status" role="status" aria-live="polite"></p>
      <button class="btn" type="submit">Conectează-te</button>
    </form>
    <div class="auth-links"><button type="button" data-auth-mode="register">Nu ai cont? Înregistrează-te</button><button type="button" data-auth-mode="reset">Ai uitat parola?</button></div>`;
  discord.after(body);
  const form = body.querySelector('form'), status = form.querySelector('.form-status'), submit = form.querySelector('[type=submit]');
  function message(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
  function resetCaptcha() { token = ''; if (widget !== undefined) window.turnstile?.reset(widget); }
  let captchaLoading;
  function loadCaptcha() {
    if (window.turnstile) return Promise.resolve();
    return captchaLoading ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.onload = resolve; script.onerror = () => { captchaLoading = null; script.remove(); reject(Error('CAPTCHA unavailable')); };
      document.head.append(script);
    });
  }
  async function captcha() {
    if (!config.turnstileSiteKey || mode === 'password' || !dialog.open) return;
    try {
      await loadCaptcha();
      if (widget !== undefined || !dialog.open) return;
      widget = window.turnstile.render('#auth-captcha', {
        sitekey: config.turnstileSiteKey, theme: 'dark', size: 'flexible', language: 'ro',
        callback: value => { token = value; message(''); },
        'expired-callback': () => { token = ''; },
        'error-callback': () => { token = ''; message('Verificarea CAPTCHA nu a reușit. Reîncearcă.', true); }
      });
    } catch { message('CAPTCHA nu s-a încărcat. Verifică rețeaua și redeschide formularul.', true); }
  }
  function setMode(next) {
    if (busy) return;
    mode = next; message(''); resetCaptcha();
    const signup = mode === 'register', password = mode === 'password', guest = mode === 'guest';
    document.querySelector('#auth-heading').textContent = ({login:'Conectare',register:'Înregistrare',reset:'Resetează parola',password:'Alege o parolă nouă',guest:'Continuă ca oaspete'})[mode];
    document.querySelector('#auth-dialog .dialog-copy').textContent = signup ? 'Creează un cont în comunitate.' : password ? 'Introdu și confirmă noua parolă.' : guest ? 'Confirmă că ești o persoană.' : 'Bine ai venit în comunitate!';
    discord.hidden = !['login','register'].includes(mode) || !client;
    body.querySelector('.auth-divider').hidden = !['login','register'].includes(mode);
    form.querySelectorAll('[data-signup]').forEach(el => { el.hidden = !signup; });
    form.elements.username.required = form.elements.consent.required = signup;
    form.querySelector('[data-email]').hidden = password || guest; form.elements.email.required = !password && !guest;
    form.querySelector('[data-password]').hidden = ['reset','guest'].includes(mode); form.elements.password.required = !['reset','guest'].includes(mode);
    form.elements.password.autocomplete = signup || password ? 'new-password' : 'current-password';
    form.querySelector('[data-confirm]').hidden = !signup && !password; form.elements.confirm.required = signup || password;
    form.elements.confirm.setCustomValidity('');
    form.querySelector('#auth-captcha').hidden = password;
    submit.textContent = ({login:'Conectează-te',register:'Înregistrează-te',reset:'Trimite linkul',password:'Salvează',guest:'Continuă'})[mode];
    body.querySelector('.auth-links').hidden = password || guest;
    const toggle = body.querySelector('[data-auth-mode]');
    toggle.dataset.authMode = mode === 'login' ? 'register' : 'login';
    toggle.textContent = mode === 'login' ? 'Nu ai cont? Înregistrează-te' : 'Ai deja cont? Conectează-te';
    captcha();
  }
  body.querySelectorAll('[data-auth-mode]').forEach(button => button.onclick = () => setMode(button.dataset.authMode));
  body.querySelector('a').onclick = () => dialog.close();
  form.elements.confirm.oninput = () => form.elements.confirm.setCustomValidity('');
  function errorText(error) {
    const code = error?.code || '', text = error?.message || '';
    if (/captcha/i.test(code + text)) return 'Verificarea CAPTCHA a expirat sau nu a reușit. Încearcă din nou.';
    if (code === 'email_not_confirmed') return 'Confirmă mai întâi adresa din e-mailul primit. Verifică și folderul Spam.';
    if (/rate_limit|over_.*limit/.test(code)) return 'Prea multe încercări. Așteaptă puțin și încearcă din nou.';
    if (/email_address_not_authorized|smtp|sending.*email/i.test(code + text)) return 'E-mailul nu a putut fi trimis. Serviciul de e-mail trebuie configurat de administrator.';
    if (code === 'invalid_credentials') return 'E-mailul sau parola nu sunt corecte.';
    if (code === 'weak_password') return 'Alege o parolă mai puternică, de minimum 8 caractere.';
    return 'Operațiunea nu a reușit. Verifică datele și încearcă din nou.';
  }
  form.onsubmit = async event => {
    event.preventDefault(); if (busy || !client || config.authEnabled === false) return;
    if (['register','password'].includes(mode) && form.elements.password.value !== form.elements.confirm.value) {
      form.elements.confirm.setCustomValidity('Parolele nu coincid.'); form.elements.confirm.reportValidity(); return;
    }
    if (config.turnstileSiteKey && mode !== 'password' && !token) { message('Completează verificarea CAPTCHA.', true); return; }
    if (mode === 'guest') { const resolve = guestResolve; guestResolve = null; const result = token; dialog.close(); resolve?.(result); return; }
    busy = true; submit.disabled = true; message('Se procesează…');
    const action = mode, options = token ? {captchaToken: token} : {};
    const email = form.elements.email.value.trim(), password = form.elements.password.value;
    try {
      let result;
      const redirectTo = config.authRedirectUrl || new URL('./', location.href).href;
      if (action === 'register') result = await client.auth.signUp({email,password,options:{...options,emailRedirectTo:redirectTo,data:{full_name:form.elements.username.value.trim(),preferred_username:form.elements.username.value.trim()}}});
      else if (action === 'reset') result = await client.auth.resetPasswordForEmail(email,{...options,redirectTo:new URL('?auth=recovery',redirectTo).href});
      else if (action === 'password') result = await client.auth.updateUser({password});
      else result = await client.auth.signInWithPassword({email,password,options});
      if (result.error) throw result.error;
      form.elements.password.value = form.elements.confirm.value = '';
      if (action === 'register' && !result.data?.session) message('Verifică e-mailul pentru confirmarea contului, inclusiv folderul Spam.');
      else if (action === 'reset') message('Dacă adresa are un cont, vei primi un link pentru resetarea parolei.');
      else { recovery = false; dialog.close(); }
    } catch (error) { message(errorText(error), true); }
    finally { busy = false; submit.disabled = false; resetCaptcha(); }
  };
  document.querySelectorAll('[data-auth-open]').forEach(button => button.addEventListener('click', () => setMode('login')));
  new MutationObserver(() => { if (dialog.open) captcha(); }).observe(dialog,{attributes:true,attributeFilter:['open']});
  dialog.addEventListener('close', () => { form.elements.password.value = form.elements.confirm.value = ''; resetCaptcha(); guestResolve?.(null); guestResolve = null; });
  addEventListener('bg3ro:auth', event => {
    client = event.detail.client;
    body.hidden = !client || config.authEnabled === false;
    // Only a successfully restored session can open the password-change form.
    if (recovery && event.detail.userId) { recovery = false; setTimeout(() => { if (!dialog.open) dialog.showModal(); setMode('password'); }, 0); }
  });
  window.BG3RO_AUTH_UI = {
    recovery(enabled = true) { recovery = enabled; },
    guestToken() { return new Promise(resolve => { if (guestResolve) { resolve(null); return; } dialog.showModal(); setMode('guest'); guestResolve = resolve; }); }
  };
  body.hidden = true; setMode('login');
})();
