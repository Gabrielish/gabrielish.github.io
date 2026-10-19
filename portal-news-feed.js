(() => {
 'use strict';
 const sources=new Map(),feed=document.querySelector('#updates-feed');
 function commit(source,nodes){
  sources.set(source,nodes);
  const all=[...sources.values()].flat().sort((a,b)=>{
   const pinned=Number(b.dataset.newsPinned==='true')-Number(a.dataset.newsPinned==='true');
   return pinned||(Date.parse(b.dataset.newsDate)||0)-(Date.parse(a.dataset.newsDate)||0)||(b.dataset.newsId||'').localeCompare(a.dataset.newsId||'');
  });
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
   if(name==='news_body')window.BG3RO_CONTENT.enhance(input);
  }
  const save=document.createElement('button');save.type='submit';save.className='btn';save.textContent='Salvează anunțul';const status=document.createElement('p');status.className='form-status';status.setAttribute('role','status');form.append(save,status);source.append(form);content.append(source);
  const editor=window.BG3RO_EDITORS.mount(source,'Editează anunțul versiunii');
  const toolbar=document.createElement('div');toolbar.className='manual-update-toolbar';toolbar.append(editor);header.append(toolbar);
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(save.disabled)return;save.disabled=true;status.textContent='Se salvează…';
   try{const payload=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,value.trim()]));
    const {data,error}=await client.from('bg3ro_releases').update(payload).eq('id',row.id).select('id');
    if(error||!data?.length)throw error||new Error('Not updated');form.closest('dialog').close();await reload();
   }catch(_){status.textContent='Anunțul nu a fost salvat. Încearcă din nou.';}finally{save.disabled=false;}
  });
 }
 window.BG3RO_NEWS={commit,releaseEditor};
})();
