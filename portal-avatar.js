(() => {
 'use strict';
 const levels=[['Utilizator',0,'user'],['Novice',50,'award'],['Ajutor',150,'team'],['Entuziast',300,'award'],['Veteran',500,'shield'],['Legendă',1000,'award']];
 function metaIcon(kind){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':true}))svg.setAttribute(key,value);svg.innerHTML=kind==='calendar'?'<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>':'<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4m8.71 3.88.7.71-2.82 2.82"/>';return svg;}
 async function publicPoints(id){
  const config=window.BG3RO_CONFIG;if(!config?.supabaseUrl||!config.supabasePublishableKey)return null;
  try{const response=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/bg3ro_profile_points?p_profile_id='+encodeURIComponent(id),{headers:{apikey:config.supabasePublishableKey},credentials:'omit',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const points=await response.json();return Number.isSafeInteger(points)&&points>=0?points:null;}catch{return null;}
 }
 window.BG3RO_PROFILE_META={levels,icon:metaIcon,publicPoints,level:points=>levels.filter(level=>level[1]<=points).at(-1)[0]};
 window.BG3RO_SAFE_AVATAR=value=>{if(/^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(avatars\/[0-9]+\/[A-Za-z0-9_]+\.(png|jpg|jpeg|webp|gif)|embed\/avatars\/[0-9]+\.png)(\?size=[0-9]+)?$/.test(value||''))return true;try{const u=new URL(value),base=new URL(window.BG3RO_CONFIG.supabaseUrl);return u.origin===base.origin&&!u.search&&!u.username&&!u.password&&/^\/storage\/v1\/object\/public\/bg3ro-avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(u.pathname);}catch{return false;}};
 // Presentation only. Callers pass a server-verified role, never profile metadata.
 window.BG3RO_AVATAR_BADGE=(image,isAdmin)=>{
  const current=image.parentElement?.classList.contains('avatar-with-role')?image.parentElement:null;
  if(isAdmin!==true){if(current)current.replaceWith(image);return image;}
  if(current)return current;
  const wrap=document.createElement('span');wrap.className='avatar-with-role';
  const badge=document.createElement('span');badge.className='avatar-admin-badge';badge.textContent='Administrator';
  if(image.parentNode)image.replaceWith(wrap);
  wrap.append(image,badge);return wrap;
 };
})();
