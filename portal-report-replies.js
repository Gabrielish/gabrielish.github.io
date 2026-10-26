(() => {
 'use strict';
 let client=null,moderator=false,epoch=0;const views=new Set();
 const element=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 function icon(kind){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':true}))svg.setAttribute(key,value);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',kind==='reply'?'m9 17-5-5 5-5M20 18v-2a4 4 0 0 0-4-4H4':kind==='edit'?'m16 3 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15l-1 6Z':'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7');svg.append(path);return svg;}
 function action(text,kind,callback){const button=element('button','btn',text);button.type='button';button.prepend(icon(kind));button.onclick=callback;return button;}
 function image(row){const img=element('img','post-avatar');let remote=false;try{const u=new URL(row.author_avatar_url),origin=new URL(window.BG3RO_CONFIG.supabaseUrl).origin;remote=u.protocol==='https:'&&!u.username&&!u.password&&(['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname)||(u.origin===origin&&u.pathname.startsWith('/storage/v1/object/public/bg3ro-avatars/')));}catch{}
  img.src=remote?row.author_avatar_url:'./assets/discussion-avatar.svg';img.classList.toggle('post-avatar-default',!remote);img.alt='';img.width=36;img.height=36;img.loading='lazy';img.referrerPolicy='no-referrer';if(remote)img.onerror=()=>{img.onerror=null;img.src='./assets/discussion-avatar.svg';img.classList.add('post-avatar-default');};return window.BG3RO_PROFILE_LINK(window.BG3RO_AVATAR_BADGE(img,row.author_is_admin===true&&!row.is_guest),row.author_profile_id,row.author_name,true);
 }
 function mount(report,article,ticket){
  const active=client,content=article.querySelector('.post-content'),layout=article.querySelector('.post'),actions=element('div','report-community-actions post-actions'),list=element('div','report-replies-list'),status=element('p','form-status report-community-status'),more=element('button','btn secondary small-btn','Mai multe răspunsuri');status.setAttribute('role','status');more.type='button';more.hidden=true;list.setAttribute('aria-label','Răspunsuri la raportare');content.append(actions,list,more,status);
  const toolbar=content.querySelector('.report-toolbar');if(toolbar){toolbar.prepend(actions);actions.classList.add('report-actions-shared');}else content.insertBefore(actions,content.querySelector('.report-answer')||list);
  let actor=null,admin=false,limit=50,sequence=0,editor=null,writing=false;
  const live=()=>ticket===epoch&&client===active&&article.isConnected;
  function closeEditor(){if(!editor)return;editor.api.destroy();editor.form.remove();editor=null;}
  const view={destroy(){sequence++;closeEditor();actions.remove();list.remove();status.remove();more.remove();}};views.add(view);
  const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error);};
  async function compose(row=null){
   if(!live()||writing)return;if(editor){editor.api.focus();return;}
   try{const result=await active.auth.getSession();if(!live())return;if(editor){editor.api.focus();return;}actor=result.data?.session?.user;if(!actor){message('Se pregătește sesiunea. Încearcă din nou în câteva momente.',true);return;}
    editor=window.BG3RO_CREATE_REPORT_REPLY?.(layout,row?.body||'');if(!editor)return;const current=editor,{form,api,cancel}=current;form.classList.add('report-comment-editor');const save=form.querySelector('[type=submit]');save.textContent=row?'Salvează':'Răspunde';
    let name=null;if(actor.is_anonymous&&!row){const field=element('div','field report-guest-name'),label=element('label','','Numele tău');name=element('input');name.id=form.id+'-name';name.type='text';name.required=true;name.minLength=2;name.maxLength=40;name.autocomplete='nickname';name.value=document.querySelector('#report-name')?.value||document.querySelector('#discussion-name')?.value||'';label.htmlFor=name.id;field.append(label,name);form.prepend(field);}
    cancel.onclick=()=>{if(!writing)closeEditor();};
    const formStatus=form.querySelector('.form-status');
    form.onsubmit=async event=>{event.preventDefault();if(writing||!live()||editor!==current)return;let body;try{body=api.value();}catch(error){message(error.message,true);return;}writing=true;save.disabled=cancel.disabled=true;formStatus.classList.remove('error');formStatus.textContent='Se salvează…';
     try{const query=active.from('bg3ro_report_replies'),result=row?await query.update({body}).eq('id',row.id).select('id'):await query.insert({report_id:report.id,author_id:actor.id,author_name:actor.is_anonymous?name.value.trim():'Jucător',body}).select('id');if(result.error||!result.data?.length)throw result.error||Error('Not saved');if(live()){closeEditor();message('');await load();}}
     catch{if(live()){formStatus.classList.add('error');formStatus.textContent='Răspunsul nu a fost salvat. Verifică textul și încearcă din nou; între trimiteri trebuie să treacă 30 de secunde.';}}
     finally{writing=false;save.disabled=cancel.disabled=false;}
    };form.scrollIntoView({block:'nearest',behavior:'instant'});if(name&&!name.value)name.focus();else api.focus();
   }catch{if(live())message('Editorul nu poate fi deschis momentan. Încearcă din nou.',true);}
  }
  actions.append(action('Răspunde','reply',()=>compose()));
  async function load(){
   const request=++sequence;
   try{const session=await active.auth.getSession();if(!live()||request!==sequence)return;actor=session.data?.session?.user||null;admin=moderator;
    const columns='id,report_id,body,author_name,author_avatar_url,author_profile_id,author_is_admin,is_guest,created_at'+(actor?',author_id':'');
    const result=await active.from('bg3ro_report_replies').select(columns,{count:'exact'}).eq('report_id',report.id).order('created_at').order('id').limit(limit);if(!live()||request!==sequence)return;if(result.error)throw result.error;
    list.replaceChildren();for(const row of result.data||[]){const answer=element('div','report-answer post'+(row.author_is_admin===true&&!row.is_guest?' report-admin-answer':'')),copy=element('div','post-content'),meta=element('div','post-meta');answer.dataset.replyId=row.id;
     const time=element('time');if(Number.isFinite(Date.parse(row.created_at))){time.dateTime=row.created_at;time.textContent=new Intl.DateTimeFormat('ro-RO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.created_at));}
     meta.append(window.BG3RO_PROFILE_LINK(element('strong','',row.author_name),row.author_profile_id,row.author_name),time);if(row.is_guest)meta.append(element('span','post-status','Oaspete'));const body=window.BG3RO_CONTENT.render(row.body);body.classList.add('report-project-reply');copy.append(meta,body);answer.append(image(row),copy);
     if(actor&&(row.author_id===actor.id||admin)){const tools=element('div','post-actions report-reply-actions');tools.append(action('Editează','edit',()=>compose(row)),action('Șterge','delete',async()=>{if(writing||!live()||!confirm('Ștergi acest răspuns?'))return;writing=true;try{const result=await active.from('bg3ro_report_replies').delete().eq('id',row.id).select('id');if(result.error||!result.data?.length)throw result.error||Error('Not deleted');if(live()){message('');await load();}}catch{if(live())message('Răspunsul nu a putut fi șters.',true);}finally{writing=false;}}));copy.append(tools);}list.append(answer);
    }more.hidden=(result.data?.length||0)>=(result.count||0);message('');
   }catch{if(live()&&request===sequence)message('Răspunsurile nu au putut fi încărcate.',true);}
  }
  more.onclick=()=>{limit+=50;load();};load();
 }
 addEventListener('bg3ro:auth',event=>{epoch++;for(const view of views)view.destroy();views.clear();client=event.detail.client;moderator=event.detail.moderator===true;});
 addEventListener('bg3ro:reports-rendered',event=>{for(const view of views)view.destroy();views.clear();if(!client)return;const ticket=epoch;for(const report of event.detail.reports){const article=document.querySelector('[data-report-id="'+CSS.escape(report.id)+'"]');if(article)mount(report,article,ticket);}});
})();
