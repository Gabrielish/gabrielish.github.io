(() => {
 'use strict';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const icon=(path)=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))s.setAttribute(k,v);const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',path);s.append(p);return s;};
 const chain='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71';
 let sequence=0;
 function field(form,name,label,type,max,value=''){
  const wrap=el('div','field'),l=el('label','',label),input=el(type==='textarea'?'textarea':'input');
  input.name=name;input.id='manual-update-'+(++sequence);l.htmlFor=input.id;input.maxLength=max;input.value=value||'';
  if(type!=='textarea')input.type=type;input.required=name==='title'||name==='body';
  if(name==='title')input.minLength=2;if(name==='body')input.minLength=10;
  wrap.append(l,input);form.append(wrap);return input;
 }
 function extras(form,data={}){
  field(form,'link_label','Numele linkului (opțional)','text',80,data.link_label);
  field(form,'link_url','Adresa linkului (opțional)','url',2000,data.link_url).placeholder='https://…';
  field(form,'badge_label','Eticheta verde (opțional)','text',80,data.badge_label);
 }
 function safeURL(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
 function values(form){
  const v=Object.fromEntries(new FormData(form));for(const k of Object.keys(v))v[k]=v[k].trim();
  if((v.link_url||v.link_label)&&(!v.link_label||!safeURL(v.link_url))){const e=new Error('Completează numele linkului și o adresă validă http:// sau https://, ori lasă ambele câmpuri goale.');e.code='MANUAL_UPDATE';throw e;}
  return {title:v.title,body:v.body,link_url:v.link_url||'',link_label:v.link_label||'',badge_label:v.badge_label||''};
 }
 const publish=document.querySelector('#update-form');
 if(publish){const save=publish.querySelector('[type=submit]'),status=publish.querySelector('.form-status');extras(publish);publish.append(save,status);}
 window.BG3RO_UPDATES={values,render(client,data,target,moderator,userId,reload){
  data.forEach(update=>{
   const article=el('article','manual-update'),layout=el('div','post'),content=el('div','post-content'),header=el('div','manual-update-header'),meta=el('div','post-meta'),avatar=el('img','post-avatar');
   const remote=/^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(avatars\/[0-9]+\/[A-Za-z0-9_]+\.(png|jpg|jpeg|webp|gif)|embed\/avatars\/[0-9]+\.png)(\?size=[0-9]+)?$/.test(update.author_avatar_url||'');
   avatar.src=remote?update.author_avatar_url:'./assets/discussion-avatar.svg';avatar.classList.toggle('post-avatar-default',!remote);avatar.alt='';avatar.width=44;avatar.height=44;avatar.loading='lazy';avatar.referrerPolicy='no-referrer';
   if(remote)avatar.addEventListener('error',()=>{avatar.classList.add('post-avatar-default');avatar.src='./assets/discussion-avatar.svg';},{once:true});
   const time=el('time','',new Intl.DateTimeFormat('ro-RO',{dateStyle:'medium'}).format(new Date(update.published_at)));time.dateTime=update.published_at;
   meta.append(el('strong','',update.author_name||'Gabrielish'),time);
   const url=safeURL(update.link_url);if(url&&update.link_label){const a=el('a','release-news-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.append(icon(chain),el('span','',update.link_label));meta.append(a);}
   if(update.badge_label)meta.append(el('span','release-version-badge',update.badge_label));
   header.append(meta);content.append(header,el('h3','post-title',update.title),el('div','post-body',update.body));layout.append(avatar,content);article.append(layout);target.append(article);
   if(!moderator)return;
   const toolbar=el('div','manual-update-toolbar');
   if(update.author_id===userId){
    const source=el('div'),form=el('form');source.id='manual-update-editor-'+update.id;
    field(form,'title','Titlu','text',160,update.title);field(form,'body','Conținut','textarea',12000,update.body);extras(form,update);
    const save=el('button','btn','Salvează modificările');save.type='submit';const status=el('p','form-status');status.setAttribute('role','status');form.append(save,status);source.append(form);content.append(source);
    const editor=window.BG3RO_EDITORS.mount(source,'Editează actualizarea');toolbar.append(editor);
    form.addEventListener('submit',async event=>{event.preventDefault();if(save.disabled)return;save.disabled=true;status.textContent='Se salvează…';
     try{const payload=values(form);const {data,error}=await client.from('bg3ro_project_updates').update(payload).eq('id',update.id).select('id');if(error||!data?.length)throw error||new Error('Not saved');form.closest('dialog').close();await reload();}
     catch(e){status.textContent=e.code==='MANUAL_UPDATE'?e.message:'Modificările nu au fost salvate. Încearcă din nou.';}finally{save.disabled=false;}
    });
   }
   const remove=el('button','edit-pencil');remove.type='button';remove.setAttribute('aria-label','Șterge actualizarea');remove.title='Șterge actualizarea';remove.append(icon('M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6'));toolbar.append(remove);header.append(toolbar);
   remove.addEventListener('click',async()=>{if(remove.disabled||!confirm('Ștergi această actualizare publicată manual?'))return;remove.disabled=true;
    try{const {data,error}=await client.from('bg3ro_project_updates').delete().eq('id',update.id).select('id');if(error||!data?.length)throw error||new Error('Not deleted');await reload();}
    catch(_){remove.disabled=false;const status=el('p','form-status','Actualizarea nu a fost ștearsă. Încearcă din nou.');status.setAttribute('role','status');content.append(status);}
   });
  });
 }};
})();
