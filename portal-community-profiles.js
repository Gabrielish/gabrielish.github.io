(() => {
 'use strict';
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const icon=(kind)=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[k,v]of Object.entries({viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':true}))s.setAttribute(k,v);const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',{posts:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',message:'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 2 10 7L22 6',plus:'M12 5v14M5 12h14',back:'m14 6-6 6 6 6',hide:'M3 3l18 18M7 7a18 18 0 0 0-6 5c3 5 8 8 13 6M10 5c5-1 9 3 11 7l-4 5'}[kind]);s.append(p);return s;};
 const button=(text,kind,action,cls='btn')=>{const b=node('button',cls);b.type='button';if(kind)b.append(icon(kind));b.append(node('span','',text));b.onclick=action;return b;};
 const date=value=>{const d=new Date(value);return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat('ro-RO',{dateStyle:'medium',timeStyle:'short'}).format(d):'';};
 const profileLink=(content,id,name,avatar=false)=>{
  if(!uuid.test(id||''))return content;
  const link=node('a',avatar?'profile-avatar-link':'profile-name-link');link.href='#profil/'+id;link.dataset.profileId=id;if(avatar)link.setAttribute('aria-label','Profilul lui '+(name||'utilizator'));else{link.dataset.profilePending='';link.setAttribute('aria-busy','true');}link.append(content);window.BG3RO_APPLY_PROFILE?.(link);return link;
 };
 window.BG3RO_PROFILE_LINK=profileLink;
 const avatar=(profile,large=false)=>{
  const image=node('img','post-avatar');image.alt='';image.width=image.height=large?108:36;image.referrerPolicy='no-referrer';
  const safe=window.BG3RO_SAFE_AVATAR(profile.avatar_url);
  image.src=safe?profile.avatar_url:'./assets/discussion-avatar.svg';image.classList.toggle('post-avatar-default',!safe);image.onerror=()=>{image.onerror=null;image.src='./assets/discussion-avatar.svg';image.classList.add('post-avatar-default');};return window.BG3RO_AVATAR_BADGE(image,profile.is_admin===true);
 };
 const root=document.querySelector('#despre').parentElement;
 const profilePanel=node('section','community-profile panel-stack');profilePanel.id='profil';profilePanel.hidden=true;root.append(profilePanel);
 const dmPanel=node('section','community-messages panel-stack');dmPanel.id='conversatii';dmPanel.hidden=true;root.append(dmPanel);
 const ownLink=document.getElementById('nav-profile'),dmLink=document.getElementById('nav-private-messages');
 let client=null,userId=null,admin=false,epoch=0,profileRequest=0,inboxRequest=0,threadRequest=0,selected=null,peer=null,inbox=[],messages=[],limit=100,more=false,editor=null,timer=null,profileId=null,sending=false;
 const drafts=new Map();let lastRoute='',starting=false;
 const heading=node('div','community-page-heading');heading.append(node('h2','','Mesaje'),button('Mesaj nou','plus',()=>{searchWrap.hidden=false;search.focus();}));
 const gate=node('div','card community-login');gate.append(node('h3','','Conectează-te pentru mesaje'),node('p','','Folosește contul Discord pentru a trimite și primi mesaje.'),button('Conectare cu Discord',null,()=>document.querySelector('[data-auth-open]').click()));
 const layout=node('div','dm-layout card'),sidebar=node('aside','dm-sidebar');sidebar.setAttribute('aria-label','Conversații');
 const searchWrap=node('div','dm-search'),searchLabel=node('label','','Caută un utilizator'),search=node('input'),searchResults=node('div','dm-search-results');search.id='dm-search';search.type='search';search.placeholder='Nume utilizator…';search.maxLength=40;searchLabel.htmlFor=search.id;searchWrap.append(searchLabel,search,searchResults);searchWrap.hidden=true;
 const list=node('nav','dm-conversations');list.setAttribute('aria-label','Conversațiile tale');sidebar.append(searchWrap,list);
 const thread=node('div','dm-thread'),threadHead=node('div','dm-thread-heading'),history=node('div','dm-history'),threadEmpty=node('p','dm-empty','Alege o conversație sau începe un mesaj nou.');history.setAttribute('aria-label','Mesajele conversației');history.setAttribute('role','region');history.tabIndex=0;
 const older=button('Mesaje mai vechi',null,()=>{limit+=100;loadThread(false,true);},'btn secondary small-btn');older.hidden=true;
 const form=node('form','dm-form'),body=node('textarea');body.name='body';body.id='private-message-body';body.maxLength=12000;body.setAttribute('aria-label','Mesaj privat');const submit=node('button','btn','Trimite');submit.type='submit';const end=node('div','form-end'),status=node('p','form-status');status.setAttribute('role','status');end.append(submit);form.append(body,end,status);form.hidden=true;
 const inboxStatus=node('p','form-status');inboxStatus.setAttribute('role','status');thread.append(threadHead,older,history,threadEmpty,form);layout.append(sidebar,thread);const sources=document.querySelector('#message-sources'),contactPanel=document.querySelector('#mesaje');dmPanel.append(heading,sources,gate,layout,inboxStatus,contactPanel);
 const note=(target,text,error=false)=>{target.textContent=text;target.classList.toggle('error',error);};
 function current(ticket){return ticket===epoch;}
 function saveDraft(){if(selected&&editor)drafts.set(selected,editor.editor.getJSON());}
 function route(){
  const [part,arg]=location.hash.slice(1).split('/');document.documentElement.classList.toggle('community-route',part==='profil'||part==='conversatii');
  if(lastRoute!==location.hash&&(part==='profil'||part==='conversatii')){lastRoute=location.hash;requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));}else lastRoute=location.hash;
  if(part==='profil'){profileId=arg;loadProfile();}
  if(part==='conversatii'){
   const contact=arg==='contact'&&admin;sources.hidden=!admin;contactPanel.hidden=!contact;gate.hidden=!!userId;layout.hidden=!userId||contact;inboxStatus.hidden=contact;for(const a of sources.querySelectorAll('a')){if(a.id===(contact?'message-contact-tab':'message-conversations-tab'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
   const next=uuid.test(arg||'')||isDemo(arg)?arg:null;if(next!==selected){saveDraft();selected=next;peer=null;messages=[];limit=100;threadRequest++;editor?.editor.commands.clearContent();if(drafts.has(next))editor?.editor.commands.setContent(drafts.get(next));note(status,'');}
   layout.classList.toggle('has-conversation',!!selected);gate.hidden=!!userId;layout.hidden=!userId||contact;heading.lastElementChild.hidden=!userId||contact;
   if(userId){loadInbox();if(selected)loadThread(true);else paintThread();}
  }
 }
 async function loadProfile(){
  if(location.hash.split('/')[0]!=='#profil')return;const request=++profileRequest,ticket=epoch,id=profileId;
  profilePanel.replaceChildren(node('p','small','Se încarcă profilul…'));
  if(!client||!uuid.test(id||'')){profilePanel.replaceChildren(node('div','card','Profilul nu este disponibil.'));return;}
  try{
   const [result,activity,points]=await Promise.all([client.from('bg3ro_profiles').select('id,display_name,avatar_url,joined_at,is_admin,bio').eq('id',id).maybeSingle(),client.from('bg3ro_discussion_posts').select('id,body,created_at,parent_id',{count:'exact'}).eq('author_id',id).eq('status','approved').order('created_at',{ascending:false}).limit(10),window.BG3RO_PROFILE_META.publicPoints(id)]);
   if(!current(ticket)||request!==profileRequest)return;if(result.error)throw result.error;
   const profile=result.data;if(!profile){profilePanel.replaceChildren(node('div','card','Profilul nu a fost găsit.'));return;}
   const hero=node('header','card profile-hero'),identity=node('div','profile-identity'),title=node('h1','',profile.display_name),joined=node('p','profile-joined');
   if(Number.isFinite(Date.parse(profile.joined_at)))joined.append(window.BG3RO_PROFILE_META.icon('calendar'),node('span','','Înregistrat pe '+new Intl.DateTimeFormat('ro-RO',{dateStyle:'long'}).format(new Date(profile.joined_at))));
   const badges=node('div','profile-badges'),meta=node('div','profile-meta');if(points!==null&&!profile.is_admin)badges.append(node('span','profile-role profile-level',window.BG3RO_PROFILE_META.level(points)));if(profile.is_admin)badges.append(node('span','profile-role profile-admin-role','Administrator'));meta.append(joined);if(points!==null){const score=node('span','profile-points');score.append(window.BG3RO_PROFILE_META.icon('coins'),node('span','',points+(points===1?' punct':' puncte')));meta.append(score);}identity.append(badges,title,meta);
   const send=button('Trimite mesaj','message',()=>startConversation(profile.id));send.classList.add('profile-send');send.hidden=profile.id===userId;meta.append(send);hero.append(avatar(profile,true),identity);
   const columns=node('div','profile-columns'),feed=node('section','card profile-activity'),stats=node('aside','card profile-stats');feed.append(node('h2','','Activitate publică'));
   if(activity.error){feed.append(node('p','','Activitatea nu a putut fi încărcată.'));}
   else{
    const stat=node('div','profile-stat-row'),label=node('span','profile-stat-label');label.append(icon('posts'),node('span','','Postări'));stat.append(label,node('strong','profile-count',String(activity.count||0)));stats.append(node('h2','','Statistici'),stat);
    if(!activity.data?.length)feed.append(node('p','small','Nu există încă postări publice.'));
    for(const post of activity.data||[]){const article=node('article','profile-activity-item'),time=node('time','',date(post.created_at));time.dateTime=post.created_at;article.append(time,window.BG3RO_CONTENT.render(post.body));feed.append(article);}
    if((activity.count||0)>10)feed.append(node('p','small','Cele mai recente 10 postări publice.'));
   }
   columns.append(feed,stats);profilePanel.replaceChildren(hero);if(profile.bio){const bio=node('section','card profile-bio');bio.append(node('h2','','Despre mine'),window.BG3RO_CONTENT.render(profile.bio));profilePanel.append(bio);}profilePanel.append(columns);
  }catch{if(current(ticket)&&request===profileRequest){profilePanel.replaceChildren(node('div','card','Profilul nu a putut fi încărcat.'),button('Reîncearcă',null,loadProfile));}}
 }
 async function startConversation(id){
  if(!userId){document.querySelector('[data-auth-open]').click();return;}
  if(id===userId||starting)return;starting=true;const ticket=epoch;note(inboxStatus,'');
  try{const {data,error}=await client.rpc('bg3ro_start_conversation',{p_recipient:id});if(!current(ticket))return;if(error||!uuid.test(data||''))throw error;await client.rpc('bg3ro_mark_conversation',{p_conversation:data,p_hide:false});if(current(ticket))location.hash='conversatii/'+data;}
  catch{if(current(ticket)){if(location.hash.startsWith('#profil/'))profilePanel.append(node('p','form-status error','Conversația nu a putut fi deschisă. Încearcă din nou.'));else note(inboxStatus,'Conversația nu a putut fi deschisă. Încearcă din nou.',true);}}finally{starting=false;}
 }
 const createDemos=()=>new Map([
 ['demo-1','Andrei · Demo',['Salut! Unde găsesc instrucțiunile pentru instalare?','În secțiunea Descărcări, sub lista versiunilor.','Mulțumesc! Verific ghidul înainte de instalare.']],
 ['demo-2','Ioana · Demo',['Bună! Pot atașa o captură la o raportare?','Da, poți adăuga mai multe capturi, în limita totală de 5 MB.']],
 ['demo-3','Mihai · Demo',['Salut! Aș vrea să ajut la testarea traducerii.','Poți descrie ce ai testat și eventualele probleme în Raportare erori.','Am înțeles. Voi include și versiunea instalată.']],
 ['demo-4','Elena · Demo',['Bună! Unde văd noutățile proiectului?','În tabul Actualizări găsești anunțurile publicate.']]
 ].map(([id,name,texts])=>[id,{id,display_name:name,avatar_url:null,hidden:false,messages:texts.map((body,i)=>({body,sender_id:i%2?'demo-self':id,created_at:null}))}]));
 let demos=createDemos();
 const isDemo=id=>admin&&demos.has(id);
 function preview(text){try{const content=window.BG3RO_CONTENT.render(text||'');return content.textContent.replace(/\s+/g,' ').slice(0,90)||(content.querySelector('img')?'Imagine':'');}catch{return '';}}
 async function loadInbox(){
  if(!client||!userId)return;const ticket=epoch,request=++inboxRequest;
  try{const {data,error}=await client.rpc('bg3ro_dm_inbox');if(!current(ticket)||request!==inboxRequest)return;if(error)throw error;inbox=Array.isArray(data)?data:[];list.replaceChildren();
   const unread=inbox.reduce((sum,row)=>sum+Number(row.unread||0),0);if(window.BG3RO_ACCOUNT_NAV)window.BG3RO_ACCOUNT_NAV.messages(unread);else dmLink.textContent=unread?'Mesaje private ('+unread+')':'Mesaje';
   const demoRows=admin?[...demos.values()].filter(r=>!r.hidden).map(r=>({...r,last_body:r.messages.at(-1)?.body})):[];
   if(!inbox.length&&!demoRows.length)list.append(node('p','dm-empty','Nu ai încă nicio conversație.'));
   for(const row of [...inbox,...demoRows]){const link=node('a','dm-conversation');link.href='#conversatii/'+row.id;link.classList.toggle('is-unread',Number(row.unread)>0);if(row.id===selected)link.setAttribute('aria-current','true');const text=node('span','dm-conversation-copy');text.append(node('strong','',row.display_name),node('span','',row.last_body?preview(row.last_body):'Niciun mesaj'));link.append(avatar(row),text);if(Number(row.unread)>0)link.append(node('span','dm-unread',String(row.unread)));list.append(link);}
   note(inboxStatus,isDemo(selected)?'Conversație demo — răspunsurile de test rămân doar în această pagină.':'');
  }catch{if(current(ticket)&&request===inboxRequest)note(inboxStatus,'Conversațiile nu au putut fi încărcate. Folosește Reîncarcă.',true);}
 }
 function paintThread(scroll=false){
  layout.classList.toggle('has-conversation',!!selected);threadHead.replaceChildren();history.replaceChildren();
  form.hidden=!selected;threadEmpty.hidden=!!selected;older.hidden=!selected||!more;
  if(!selected){threadEmpty.hidden=false;return;}
  if(!peer){threadEmpty.hidden=false;threadEmpty.textContent='Conversația nu este disponibilă.';form.hidden=true;return;}
  threadEmpty.hidden=true;form.hidden=false;
  const back=button('Înapoi','back',()=>location.hash='conversatii','btn dm-back'),identity=node('div','dm-peer');identity.append(profileLink(avatar(peer),peer.id,peer.display_name,true),profileLink(node('strong','',peer.display_name),peer.id,peer.display_name));
  const hide=button('Ascunde conversația','hide',async()=>{if(isDemo(selected)){demos.get(selected).hidden=true;location.hash='conversatii';return;}if(sending||!confirm('Ascunzi conversația din lista ta? Celălalt participant își păstrează mesajele.'))return;const ticket=epoch,id=selected;hide.disabled=true;try{const {error}=await client.rpc('bg3ro_mark_conversation',{p_conversation:id,p_hide:true});if(error)throw error;if(current(ticket)&&selected===id)location.hash='conversatii';}catch{if(current(ticket))note(status,'Conversația nu a fost ascunsă.',true);}finally{hide.disabled=false;}},'btn dm-hide');
  threadHead.append(back,identity,hide);
  if(!messages.length)history.append(node('p','dm-empty','Încă nu există mesaje. Scrie ceva!'));
  for(const message of messages){const item=node('article','dm-message'+(message.sender_id===userId?' is-own':'')),meta=node('div','dm-message-meta'),time=node('time','',isDemo(selected)?'Demo':date(message.created_at));if(message.created_at)time.dateTime=message.created_at;meta.append(node('strong','',message.sender_id===userId?'Tu':peer.display_name),time);item.append(meta,window.BG3RO_CONTENT.render(message.body));history.append(item);}
  if(scroll)history.scrollTop=history.scrollHeight;
 }
 async function loadThread(scroll=false,olderPage=false){
  if(!client||!userId||!selected)return;const ticket=epoch,request=++threadRequest,id=selected,active=client;
  try{
   if(isDemo(id)){const demo=demos.get(id);peer=demo;more=false;messages=demo.messages.map(m=>({...m,sender_id:m.sender_id==='demo-self'?userId:m.sender_id}));paintThread(scroll);note(inboxStatus,'Conversații demo: mesajele de test rămân doar în această pagină și dispar la reîncărcare.');return;}
   const conv=await active.from('bg3ro_conversations').select('id,user_a,user_b').eq('id',id).maybeSingle();if(!current(ticket)||request!==threadRequest||id!==selected)return;if(conv.error||!conv.data)throw conv.error;
   const other=conv.data.user_a===userId?conv.data.user_b:conv.data.user_a;
   const [person,rows]=await Promise.all([active.from('bg3ro_profiles').select('id,display_name,avatar_url,is_admin').eq('id',other).maybeSingle(),active.from('bg3ro_direct_messages').select('id,sender_id,body,created_at').eq('conversation_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(0,limit)]);
   if(!current(ticket)||request!==threadRequest||id!==selected)return;if(person.error||rows.error||!person.data)throw person.error||rows.error;
   const oldHeight=history.scrollHeight,oldTop=history.scrollTop,nearBottom=oldHeight-oldTop-history.clientHeight<80;peer=person.data;more=rows.data.length>limit;messages=rows.data.slice(0,limit).reverse();paintThread(scroll||(!olderPage&&nearBottom));if(olderPage)history.scrollTop=history.scrollHeight-oldHeight+oldTop;
   if(!document.hidden&&location.hash==='#conversatii/'+id){await active.rpc('bg3ro_mark_conversation',{p_conversation:id,p_hide:false});if(current(ticket))loadInbox();}
  }catch{if(current(ticket)&&id===selected){peer=null;paintThread();note(inboxStatus,'Mesajele nu au putut fi încărcate. Folosește Reîncarcă.',true);}}
 }
 let searchTimer,searchRequest=0;
 search.addEventListener('input',()=>{clearTimeout(searchTimer);const request=++searchRequest;searchResults.replaceChildren();const text=search.value.trim().replace(/[\\%_]/g,'');if(text.length<2)return;searchTimer=setTimeout(async()=>{const ticket=epoch;try{const {data,error}=await client.from('bg3ro_profiles').select('id,display_name,avatar_url,is_admin').ilike('display_name','%'+text+'%').order('display_name').limit(20);if(!current(ticket)||request!==searchRequest)return;if(error)throw error;const choices=(data||[]).filter(p=>p.id!==userId);if(!choices.length)searchResults.append(node('p','small','Niciun utilizator găsit.'));for(const profile of choices){const b=button(profile.display_name,null,()=>startConversation(profile.id),'dm-search-result');b.prepend(avatar(profile));searchResults.append(b);}}catch{if(current(ticket)&&request===searchRequest)searchResults.append(node('p','small','Căutarea nu este disponibilă.'));}},250);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(sending||!userId||!selected||!peer)return;let value;try{value=editor.value();}catch(error){note(status,error.message,true);return;}
  if(isDemo(selected)){demos.get(selected).messages.push({sender_id:'demo-self',body:value,created_at:null});drafts.delete(selected);editor.reset();loadThread(true);loadInbox();return;}
  const ticket=epoch,id=selected,active=client,author=userId;sending=true;submit.disabled=true;editor.editor.setEditable(false,false);note(status,'Se trimite…');
  try{const {error}=await active.from('bg3ro_direct_messages').insert({conversation_id:id,sender_id:author,body:value});if(error)throw error;if(!current(ticket))return;drafts.delete(id);if(selected===id){editor.reset();note(status,'');await loadThread(true);}await loadInbox();}
  catch(error){if(current(ticket))note(status,error?.code==='P0001'?'Așteaptă câteva secunde și încearcă din nou.':'Mesajul nu a fost trimis. Textul a fost păstrat; încearcă din nou.',true);}
  finally{if(current(ticket)){sending=false;submit.disabled=false;editor.editor.setEditable(true,false);}}
 });
 const refresh=button('Reîncarcă',null,()=>{loadInbox();if(selected)loadThread(false);},'btn secondary small-btn');heading.insertBefore(refresh,heading.lastElementChild);
 document.addEventListener('DOMContentLoaded',()=>{editor=window.BG3RO_MOUNT_CONTENT_EDITOR(form,body,{minimum:1,label:'Mesaj privat',placeholder:'Scrie un mesaj…'});submit.disabled=false;},{once:true});
 addEventListener('bg3ro:auth',event=>{
  const previous=userId;epoch++;profileRequest++;inboxRequest++;threadRequest++;client=event.detail.client;userId=event.detail.userId;admin=event.detail.moderator===true;ownLink.hidden=dmLink.hidden=!userId;if(userId)ownLink.href='#profil/'+userId;
  if(previous!==userId){demos=createDemos();drafts.clear();messages=[];inbox=[];peer=null;list.replaceChildren();history.replaceChildren();editor?.editor.commands.clearContent();editor?.editor.setEditable(true);body.value='';searchResults.replaceChildren();search.value='';searchRequest++;clearTimeout(searchTimer);note(status,'');note(inboxStatus,'');sending=false;submit.disabled=false;}
  clearInterval(timer);route();if(userId){loadInbox();timer=setInterval(()=>{if(document.hidden)return;loadInbox();if(location.hash.startsWith('#conversatii/')&&selected)loadThread(false);},20000);}
 });
 addEventListener('hashchange',route);addEventListener('popstate',route);
 addEventListener('bg3ro:tab',event=>{const community=['profil','conversatii'].includes(event.detail.id);document.documentElement.classList.toggle('community-route',community);if(!community)lastRoute=location.hash;});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&userId){loadInbox();if(location.hash.startsWith('#conversatii/')&&selected)loadThread(false);}});
 route();
})();
