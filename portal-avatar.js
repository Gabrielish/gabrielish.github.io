(() => {
 'use strict';
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
