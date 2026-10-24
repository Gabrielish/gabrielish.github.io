(() => {
 'use strict';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const icon=(path)=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))s.setAttribute(k,v);const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',path);s.append(p);return s;};
 const chain='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71';
 let sequence=0;
 const richForms=new Map();
 function mountBody(form){const textarea=form.querySelector('textarea'),api=window.BG3RO_MOUNT_CONTENT_EDITOR?window.BG3RO_MOUNT_CONTENT_EDITOR(form,textarea):{value(){if(textarea.value.startsWith('BG3RO-RICH-1:'))throw Error('Editorul de text nu s-a încărcat. Reîncarcă pagina pentru a păstra formatarea.');if(textarea.value.trim().length<10||textarea.value.length>12000)throw Error('Scrie între 10 și 12000 de caractere.');return textarea.value;},focus(){textarea.focus();},reset(){textarea.value='';},destroy(){}};richForms.set(form,api);return api;}
 function dispose(form){richForms.get(form)?.destroy();richForms.delete(form);}
 function action(label,kind,callback){const paths={delete:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',edit:'m16 3 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15l-1 6Z',hide:'M3 3l18 18M7 7a18 18 0 0 0-6 5c3 5 8 8 13 6M10 5c5-1 9 3 11 7l-4 5',show:'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Zm14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0'};const button=el('button','btn update-action');button.type='button';button.append(icon(paths[kind]||paths.edit),el('span','',label));button.addEventListener('click',callback);return button;}
 function field(form,name,label,type,max,value=''){
  const wrap=el('div','field'),l=el('label','',label),input=el(type==='textarea'?'textarea':'input');
  input.name=name;input.id='manual-update-'+(++sequence);l.htmlFor=input.id;input.maxLength=max;input.value=value||'';
  if(type!=='textarea')input.type=type;input.required=name==='title'||name==='body';
  if(name==='title')input.minLength=2;if(name==='body')input.minLength=10;
  wrap.append(l,input);form.append(wrap);return input;
 }
 function extras(form,data={}){
  const title=form.querySelector('[name=title]').closest('.field'),badge=field(form,'badge_label','Etichetă','text',80,data.badge_label).closest('.field'),top=el('div','update-field-row');
  title.before(top);top.append(title,badge);
  const url=field(form,'link_url','Adresă link','url',2000,data.link_url);url.placeholder='https://…';
  const name=field(form,'link_label','Nume link','text',80,data.link_label),links=el('div','update-field-row');url.closest('.field').before(links);links.append(url.closest('.field'),name.closest('.field'));
 }
 function safeURL(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
 function values(form){
  if(richForms.has(form)){try{form.querySelector('textarea').value=richForms.get(form).value();}catch(error){error.code='MANUAL_UPDATE';throw error;}}
  const v=Object.fromEntries(new FormData(form));for(const k of Object.keys(v))v[k]=v[k].trim();
  if((v.link_url||v.link_label)&&(!v.link_label||!safeURL(v.link_url))){const e=new Error('Completează numele linkului și o adresă validă http:// sau https://, ori lasă ambele câmpuri goale.');e.code='MANUAL_UPDATE';throw e;}
  return {title:v.title,body:v.body,link_url:v.link_url||'',link_label:v.link_label||'',badge_label:v.badge_label||''};
 }
 const publish=document.querySelector('#update-form');
 if(publish){const save=publish.querySelector('[type=submit]'),status=publish.querySelector('.form-status'),end=el('div','form-end');extras(publish);end.append(save);publish.append(end,status);const details=publish.closest('details'),toggle=details.querySelector('summary');details.classList.add('card');toggle.prepend(icon('M12 5v14M5 12h14'));toggle.setAttribute('role','button');toggle.setAttribute('aria-expanded',String(details.open));details.addEventListener('toggle',()=>toggle.setAttribute('aria-expanded',String(details.open)));}
 document.addEventListener('DOMContentLoaded',()=>{if(publish)mountBody(publish);},{once:true});
 window.BG3RO_UPDATES={values,action,mountBody,disposeWithin(nodes){for(const form of [...richForms.keys()])if(nodes.some(node=>node.contains(form))){dispose(form);}},render(client,data,target,moderator,userId,reload){
  data.forEach(stored=>{
   if(!moderator&&stored.is_visible===false)return;
   const update={...stored};for(const field of ['title','body','badge_label'])update[field]=window.BG3RO_VERSIONS.text(update[field]);
   const article=el('article','card manual-update'),layout=el('div','post'),content=el('div','post-content'),header=el('div','manual-update-header'),meta=el('div','post-meta'),avatar=el('img','post-avatar');
   const remote=/^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(avatars\/[0-9]+\/[A-Za-z0-9_]+\.(png|jpg|jpeg|webp|gif)|embed\/avatars\/[0-9]+\.png)(\?size=[0-9]+)?$/.test(update.author_avatar_url||'');
   avatar.src=remote?update.author_avatar_url:'./assets/discussion-avatar.svg';avatar.classList.toggle('post-avatar-default',!remote);avatar.alt='';avatar.width=44;avatar.height=44;avatar.loading='lazy';avatar.referrerPolicy='no-referrer';
   if(remote)avatar.addEventListener('error',()=>{avatar.classList.add('post-avatar-default');avatar.src='./assets/discussion-avatar.svg';},{once:true});
   const time=el('time','',new Intl.DateTimeFormat('ro-RO',{dateStyle:'medium'}).format(new Date(update.published_at)));time.dateTime=update.published_at;
   meta.append(el('strong','',update.author_name||'Gabrielish'),time);
   if(update.is_visible===false){article.classList.add('news-is-hidden');meta.append(el('span','news-hidden-label','Ascuns — vizibil doar administratorului'));}
   const url=safeURL(update.link_url);if(url&&update.link_label){const a=el('a','release-news-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.append(icon(chain),el('span','',update.link_label));meta.append(a);}
   if(update.badge_label)meta.append(el('span','release-version-badge',update.badge_label));
   header.append(meta);content.append(header,el('h3','post-title',update.title),window.BG3RO_CONTENT.render(update.body));layout.append(avatar,content);article.append(layout);target.append(article);
   article.dataset.newsDate=update.published_at;article.dataset.newsId=update.id;
   if(!moderator)return;
   const toolbar=el('div','manual-update-toolbar');
   if(update.author_id===userId){
    let form=null;
    const edit=action('Editează','edit',()=>{
    if(form){richForms.get(form)?.focus();return;}
    form=el('form','update-inline-editor');form.setAttribute('aria-label','Editează actualizarea');
    field(form,'title','Titlu','text',160,update.title);field(form,'body','Conținut','textarea',12000,update.body);extras(form,update);
    const save=el('button','btn','Salvează modificările');save.type='submit';const cancel=el('button','btn update-cancel','Anulează');cancel.type='button';const end=el('div','form-end');end.append(cancel,save);const status=el('p','form-status');status.setAttribute('role','status');form.append(end,status);content.append(form);
    const api=mountBody(form);cancel.onclick=()=>{if(save.disabled)return;dispose(form);form.remove();form=null;edit.focus({preventScroll:true});};
    form.addEventListener('submit',async event=>{event.preventDefault();if(save.disabled)return;save.disabled=true;status.textContent='Se salvează…';
     try{const payload=values(form);const {data,error}=await client.from('bg3ro_project_updates').update(payload).eq('id',update.id).select('id');if(error||!data?.length)throw error||new Error('Not saved');await reload();}
     catch(e){status.textContent=e.code==='MANUAL_UPDATE'?e.message:'Modificările nu au fost salvate. Încearcă din nou.';}finally{save.disabled=false;}
    });
    form.scrollIntoView({block:'nearest',behavior:'instant'});api.focus();
    });edit.setAttribute('aria-label','Editează actualizarea');toolbar.append(edit);
    const visibility=action(update.is_visible===false?'Afișează':'Ascunde',update.is_visible===false?'show':'hide',async()=>{
     if(visibility.disabled||form?.querySelector('[type=submit]').disabled)return;if(form&&!confirm('Închizi editorul și schimbi vizibilitatea actualizării?'))return;for(const b of toolbar.querySelectorAll('button'))b.disabled=true;
     try{const {data,error}=await client.from('bg3ro_project_updates').update({is_visible:update.is_visible===false}).eq('id',update.id).select('id');if(error||!data?.length)throw error||Error('Not saved');await reload();document.querySelector('#updates-feed [data-news-id="'+CSS.escape(update.id)+'"] [data-news-visibility]')?.focus({preventScroll:true});}
     catch{const status=el('p','form-status error','Vizibilitatea nu a fost salvată. Încearcă din nou.');status.setAttribute('role','status');content.append(status);}finally{for(const b of toolbar.querySelectorAll('button'))b.disabled=false;}
    });visibility.setAttribute('aria-label',(update.is_visible===false?'Afișează':'Ascunde')+' actualizarea');visibility.dataset.newsVisibility='true';toolbar.append(visibility);
   }
   const remove=action('Șterge','delete',()=>{});remove.setAttribute('aria-label','Șterge actualizarea');remove.title='Șterge actualizarea';toolbar.append(remove);content.append(toolbar);
   remove.addEventListener('click',async()=>{if(remove.disabled||!confirm('Ștergi această actualizare publicată manual?'))return;remove.disabled=true;
    try{const {data,error}=await client.from('bg3ro_project_updates').delete().eq('id',update.id).select('id');if(error||!data?.length)throw error||new Error('Not deleted');await reload();}
    catch(_){remove.disabled=false;const status=el('p','form-status','Actualizarea nu a fost ștearsă. Încearcă din nou.');status.setAttribute('role','status');content.append(status);}
   });
  });
 }};
})();
