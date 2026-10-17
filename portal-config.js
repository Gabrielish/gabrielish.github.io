// Public browser configuration only. Never add service_role or database passwords.
window.BG3RO_CONFIG = Object.freeze({
  supabaseUrl: 'https://gatkiwcyjgbgjwfgvplm.supabase.co',
  supabasePublishableKey: 'sb_publishable_8wgqYScl0lmXs3-x0feaIw_4z7kr4bd',
  // Discord credentials stay in Supabase, never in the browser configuration.
  authEnabled: true,
  authRedirectUrl: 'https://gabrielish.github.io/'
});
