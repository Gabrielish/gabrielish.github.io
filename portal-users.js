(() => {
 'use strict';
 const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const panel=node('section','community-users panel-stack');panel.id='utilizatori';panel.hidden=true;panel.setAttribute('aria-label','Utilizatori');document.querySelector('#despre').parentElement.append(panel);
 let client=null,allowed=false,known=false,user=null,sequence=0,page=0,delay,ui=null;
 const active=()=>location.hash.slice(1).split('/')[0]==='utilizatori';
 function glyph(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[k,v]of Object.entries({viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':true}))svg.setAttribute(k,v);svg.innerHTML='<path d="M16 21v-2a5 5 0 0 0-10 0v2M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-3a4 4 0 0 1 0 8m2 9v-2a5 5 0 0 0-3-4"/>';return svg;}
 function deny(){panel.replaceChildren(node('div','card users-access','Această pagină este disponibilă doar administratorului.'));ui=null;}
 function shell(){
  panel.replaceChildren();const head=node('header','users-heading'),title=node('div'),heading=node('h1','','Utilizatori'),total=node('p','small users-total');heading.prepend(glyph());title.append(heading,total);const back=node('a','btn secondary small-btn','Setările profilului');back.href='#setari/profil';head.append(title,back);
  const controls=node('form','card users-controls'),search=node('input'),role=node('select'),sort=node('select');search.type='search';search.maxLength=80;search.placeholder='Caută un utilizator…';search.autocomplete='off';
  for(const[value,text]of [['all','Toate rolurile'],['admin','Administratori'],['member','Membri']]){const option=node('option','',text);option.value=value;role.append(option);}
  for(const[value,text]of [['newest','Cei mai noi'],['oldest','Cei mai vechi'],['name','Nume A–Z'],['points','Cele mai multe puncte']]){const option=node('option','',text);option.value=value;sort.append(option);}
  for(const[label,input]of [['Caută după nume',search],['Rol',role],['Ordonează',sort]]){const field=node('label','field');input.setAttribute('aria-label',label);field.append(node('span','',label),input);controls.append(field);}
  const list=node('div','users-grid'),status=node('p','form-status'),pager=node('nav','users-pager'),previous=node('button','btn secondary small-btn','Înapoi'),next=node('button','btn secondary small-btn','Înainte'),position=node('span','small');status.setAttribute('role','status');pager.setAttribute('aria-label','Paginile listei de utilizatori');previous.type=next.type='button';previous.disabled=next.disabled=true;pager.hidden=true;pager.append(previous,position,next);panel.append(head,controls,status,list,pager);
  ui={total,search,role,sort,list,status,pager,previous,next,position};
  controls.onsubmit=e=>{e.preventDefault();clearTimeout(delay);page=0;load();};search.oninput=()=>{clearTimeout(delay);sequence++;page=0;delay=setTimeout(load,250);};for(const select of [role,sort])select.onchange=()=>{clearTimeout(delay);page=0;load();};previous.onclick=()=>{page=Math.max(0,page-1);load();};next.onclick=()=>{page++;load();};
 }
 function card(p){
  const article=node('article','card users-card'),link=node('a','users-identity');link.href='#profil/'+p.id;const image=node('img','post-avatar');image.alt='';image.width=image.height=44;image.loading='lazy';image.referrerPolicy='no-referrer';const safe=window.BG3RO_SAFE_AVATAR(p.avatar_url);image.src=safe?p.avatar_url:'./assets/discussion-avatar.svg';image.classList.toggle('post-avatar-default',!safe);image.onerror=()=>{image.onerror=null;image.src='./assets/discussion-avatar.svg';image.classList.add('post-avatar-default');};
  const identity=node('div','users-name'),badges=node('div','profile-badges');badges.append(node('span','profile-role profile-level',window.BG3RO_PROFILE_META.level(Number(p.points)||0)));if(p.is_admin===true)badges.append(node('span','profile-role profile-admin-role','Admin'));identity.append(node('h2','',p.display_name),badges);link.append(window.BG3RO_AVATAR_BADGE(image,p.is_admin===true),identity);article.append(link);
  const meta=node('div','users-meta'),date=node('span'),score=node('span','users-points');if(p.joined_at&&Number.isFinite(Date.parse(p.joined_at))){date.append(window.BG3RO_PROFILE_META.icon('calendar'),document.createTextNode(new Intl.DateTimeFormat('ro-RO',{dateStyle:'medium'}).format(new Date(p.joined_at))));meta.append(date);}score.append(window.BG3RO_PROFILE_META.icon('coins'),document.createTextNode(String(p.points||0)+' puncte'));meta.append(score,node('span','',String(p.posts||0)+' postări'));article.append(meta);return article;
 }
 async function load(){
  if(!active()||!allowed||!client||!ui)return;const ticket=++sequence,view=ui;view.list.setAttribute('aria-busy','true');view.previous.disabled=view.next.disabled=true;view.status.textContent='';
  try{const result=await client.rpc('bg3ro_admin_users',{p_search:view.search.value.trim(),p_sort:view.sort.value,p_role:view.role.value,p_page:page,p_size:24});if(ticket!==sequence||!allowed||ui!==view)return;if(result.error){if(result.error.code==='42501'){allowed=false;deny();return;}throw result.error;}const data=result.data;if(!data||!Array.isArray(data.users)||!Number.isSafeInteger(data.total))throw Error();
   if(!data.users.length&&page>0){page=Math.max(0,Math.ceil(data.total/24)-1);return load();}
   view.total.textContent=data.total===1?'1 utilizator':data.total+' utilizatori';view.list.replaceChildren(...data.users.map(card));if(!data.users.length)view.list.append(node('p','card users-empty','Nu există utilizatori care să corespundă căutării.'));view.previous.disabled=page===0;view.next.disabled=(page+1)*24>=data.total;view.pager.hidden=data.total<=24;view.position.textContent='Pagina '+(page+1)+' din '+Math.max(1,Math.ceil(data.total/24));
  }catch{if(ticket===sequence&&ui===view){view.status.classList.add('error');view.status.replaceChildren(document.createTextNode('Lista nu a putut fi actualizată. '));const retry=node('button','users-retry','Reîncearcă');retry.type='button';retry.onclick=load;view.status.append(retry);}}
  finally{if(ticket===sequence&&ui===view)view.list.setAttribute('aria-busy','false');}
 }
 function route(){if(!active())return;document.documentElement.classList.add('community-route');window.scrollTo({top:0,behavior:'instant'});if(!known)return;if(!allowed){deny();return;}if(!ui)shell();load();}
 addEventListener('bg3ro:auth',event=>{const next=!!event.detail.userId&&event.detail.moderator===true,changed=user!==event.detail.userId||allowed!==next;client=event.detail.client;known=true;user=event.detail.userId;allowed=next;if(changed||!allowed){sequence++;clearTimeout(delay);panel.replaceChildren();ui=null;page=0;}if(changed||!ui)route();});
 addEventListener('hashchange',route);addEventListener('popstate',route);route();
})();
