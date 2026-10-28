(() => {
 'use strict';
 if(window.BG3RO_PUBLIC_DATA){window.BG3RO_PUBLIC_ABOUT=window.BG3RO_PUBLIC_DATA.refresh('about').then(value=>value?.data||null);return;}
 const config=window.BG3RO_CONFIG||{},key=config.supabasePublishableKey||'';
 // Start the anonymous, RLS-filtered read before the authentication SDK loads.
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.supabaseUrl||'')||!(/^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(key)))return;
 window.BG3RO_PUBLIC_ABOUT=fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/bg3ro_about_sections?select=*&order=sort_order.asc,id.asc',{
  headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(8000)
 }).then(response=>{if(!response.ok)throw Error('Unavailable');return response.json();}).then(rows=>Array.isArray(rows)?rows.filter(row=>row.is_visible===true):null).catch(()=>null);
})();
