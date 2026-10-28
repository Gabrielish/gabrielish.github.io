(() => {
 'use strict';
 const sources=new Map(),feed=document.querySelector('#updates-feed');
 function commit(source,nodes){
  window.BG3RO_UPDATES?.disposeWithin(sources.get(source)||[]);
  sources.set(source,nodes);
  const all=[...sources.values()].flat().sort((a,b)=>{
   const pinned=Number(b.dataset.newsPinned==='true')-Number(a.dataset.newsPinned==='true');
   return pinned||(Date.parse(b.dataset.newsDate)||0)-(Date.parse(a.dataset.newsDate)||0)||(b.dataset.newsId||'').localeCompare(a.dataset.newsId||'');
  });
  if(!all.length&&sources.size<2)return;
  if(!all.length){const p=document.createElement('p');p.className='card small';p.textContent='Nu sunt încă actualizări publicate.';feed.replaceChildren(p);}
  else feed.replaceChildren(...all);
 }
 let sequence=0;
 function releaseEditor(article,row,client,reload){
  const content=article.querySelector('.post-content'),meta=content.querySelector('.post-meta');
  const header=document.createElement('div');header.className='manual-update-header archived-release-header';meta.before(header);header.append(meta);
  const source=document.createElement('div'),form=document.createElement('form');source.id='release-news-editor-'+row.id;
  for(const [name,title,max,value] of [['news_title','Titlu',160,row.news_title??row.title],['news_body','Conținut',12000,row.news_body??row.description],['news_badge','Eticheta verde (opțional)',80,row.news_badge??('Versiunea '+row.version)]]){
   const field=document.createElement('div');field.className='field';const label=document.createElement('label');label.textContent=title;
   const input=document.createElement(name==='news_body'?'textarea':'input');input.id='release-news-field-'+(++sequence);input.name=name;input.value=value;input.maxLength=max;input.required=name!=='news_badge';label.htmlFor=input.id;field.append(label,input);form.append(field);
  }
  const save=document.createElement('button');save.type='submit';save.className='btn';save.textContent='Salvează anunțul';const status=document.createElement('p');status.className='form-status';status.setAttribute('role','status');const cancel=document.createElement('button');cancel.type='button';cancel.className='btn update-cancel';cancel.textContent='Anulează';const end=document.createElement('div');end.className='form-end';end.append(cancel,save);form.append(end,status);form.className='update-inline-editor';source.append(form);source.hidden=true;content.append(source);
  let api=null;const editor=window.BG3RO_UPDATES.action('Editează','edit',()=>{source.hidden=false;if(!api)api=window.BG3RO_UPDATES.mountBody(form);form.scrollIntoView({block:'nearest',behavior:'instant'});api.focus();});editor.setAttribute('aria-label','Editează anunțul versiunii');
  cancel.onclick=()=>{if(save.disabled)return;source.hidden=true;api?.reset();form.elements.news_title.value=row.news_title??row.title;form.elements.news_badge.value=row.news_badge??('Versiunea '+row.version);const original=row.news_body??row.description;if(api?.editor){if(original.startsWith('BG3RO-RICH-1:'))api.editor.commands.setContent(api.documentFor(original));else api.editor.commands.setContent(window.BG3RO_CONTENT.render(original).innerHTML);}else form.elements.news_body.value=original;status.textContent='';editor.focus({preventScroll:true});};
  const toolbar=document.createElement('div');toolbar.className='manual-update-toolbar';toolbar.append(editor);source.before(toolbar);
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(save.disabled)return;save.disabled=true;status.textContent='Se salvează…';
   try{const payload=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,value.trim()]));payload.news_body=api.value();
    const {data,error}=await client.from('bg3ro_releases').update(payload).eq('id',row.id).select('id');
    if(error||!data?.length)throw error||new Error('Not updated');await reload();
   }catch(_){status.textContent='Anunțul nu a fost salvat. Încearcă din nou.';}finally{save.disabled=false;}
  });
 }
 function releaseVisibility(article,row,client,reload){
  const content=article.querySelector('.post-content'),hidden=row.news_is_visible===false;let tools=content.querySelector('.manual-update-toolbar');if(!tools){tools=document.createElement('div');tools.className='manual-update-toolbar';content.append(tools);}
  if(hidden)article.classList.add('news-is-hidden','is-content-hidden');
  const button=window.BG3RO_UPDATES.action(hidden?'Afișează':'Ascunde',hidden?'show':'hide',async()=>{if(button.disabled||article.querySelector('form [type=submit]')?.disabled)return;const source=article.querySelector('[id^="release-news-editor-"]');if(source&&!source.hidden&&!confirm('Închizi editorul și schimbi vizibilitatea anunțului?'))return;for(const b of tools.querySelectorAll('button'))b.disabled=true;
   try{const {data,error}=await client.from('bg3ro_releases').update({news_is_visible:hidden}).eq('id',row.id).select('id');if(error||!data?.length)throw error||Error('Not saved');await reload();document.querySelector('#updates-feed [data-news-id="'+CSS.escape(row.id)+'"] [data-news-visibility]')?.focus({preventScroll:true});}
   catch{const status=document.createElement('p');status.className='form-status error';status.setAttribute('role','status');status.textContent='Vizibilitatea anunțului nu a fost salvată. Încearcă din nou.';content.append(status);}finally{for(const b of tools.querySelectorAll('button'))b.disabled=false;}
  });button.dataset.newsVisibility='true';button.setAttribute('aria-label',(hidden?'Afișează':'Ascunde')+' anunțul versiunii');button.title='Schimbă doar anunțul din Actualizări, nu și descărcarea';tools.append(button);
 }
 window.BG3RO_NEWS={commit,releaseEditor,releaseVisibility};
})();
