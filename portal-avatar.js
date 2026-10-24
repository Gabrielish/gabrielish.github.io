(() => {
 'use strict';
 window.BG3RO_SAFE_AVATAR=value=>{if(/^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(avatars\/[0-9]+\/[A-Za-z0-9_]+\.(png|jpg|jpeg|webp|gif)|embed\/avatars\/[0-9]+\.png)(\?size=[0-9]+)?$/.test(value||''))return true;try{const u=new URL(value),base=new URL(window.BG3RO_CONFIG.supabaseUrl);return u.origin===base.origin&&!u.search&&!u.username&&!u.password&&/^\/storage\/v1\/object\/public\/bg3ro-avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(u.pathname);}catch{return false;}};
 // Presentation only. Callers pass a server-verified role, never profile metadata.
 window.BG3RO_AVATAR_BADGE=(image,isAdmin)=>{
  const current=image.parentElement?.classList.contains('avatar-with-role')?image.parentElement:null;
  if(isAdmin!==true){if(current)current.replaceWith(image);return image;}
  if(current)return current;
  const wrap=document.createElement('span');wrap.className='avatar-with-role';
  const badge=document.createElement('span');badge.className='avatar-admin-badge';badge.textContent='Admin';
  if(image.parentNode)image.replaceWith(wrap);
  wrap.append(image,badge);return wrap;
 };
})();
