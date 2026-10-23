(() => {
 'use strict';
 const form=document.querySelector('#report-form'),input=document.querySelector('#report-photo');
 if(!form||!input)return;
 const preview=document.querySelector('#report-photo-preview'),remove=document.querySelector('#report-photo-remove'),hint=document.querySelector('#report-photo-status');
 let thumbnail=document.querySelector('#report-photo-thumbnail');
 if(!thumbnail){thumbnail=document.createElement('div');preview.before(thumbnail);thumbnail.append(preview,remove);}
 const gallery=document.createElement('div');gallery.id='report-photo-gallery';thumbnail.before(gallery);gallery.append(thumbnail);
 const template=thumbnail.cloneNode(true);input.multiple=true;
 const drop=document.querySelector('#report-photo-drop'),browse=document.querySelector('#report-photo-browse'),fileLabel=document.querySelector('#report-photo-label');
 if(browse)browse.addEventListener('click',()=>{if(!input.disabled)input.click();});
 if(drop){
  ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();if(!input.disabled)drop.classList.add('drag-over');}));
  ['dragleave','drop'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('drag-over');}));
  drop.addEventListener('drop',e=>{if(!input.disabled)addFiles([...e.dataTransfer.files]);});
 }
 const bucket='bg3ro-report-images',limit=5*1024*1024;
 let selected=[],pending=null,frozen=[],selectionTask=Promise.resolve(),selectionEpoch=0,lockedEditors=[];
 let viewer=null,viewerImage=null;
 function openPhoto(url){
  if(!viewer){
   viewer=document.createElement('dialog');viewer.className='report-photo-viewer';viewer.setAttribute('aria-label','Fotografia raportării');
   const close=document.createElement('button');close.type='button';close.className='dialog-close';close.setAttribute('aria-label','Închide fotografia');close.autofocus=true;
   viewerImage=document.createElement('img');viewerImage.alt='Fotografia atașată raportării, mărită';viewerImage.referrerPolicy='no-referrer';
   close.addEventListener('click',()=>viewer.close());
   viewer.addEventListener('click',event=>{if(event.target!==viewer)return;const r=viewer.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)viewer.close();});
   viewer.addEventListener('close',()=>viewerImage.removeAttribute('src'));
   viewer.append(close,viewerImage);document.body.append(viewer);
  }
  viewerImage.src=url;if(!viewer.open)viewer.showModal();
 }
 function error(message){const e=new Error(message);e.code='REPORT_PHOTO';return e;}
 function reportPaths(report){return Array.isArray(report.screenshot_paths)&&report.screenshot_paths.length?[...report.screenshot_paths]:report.screenshot_path?[report.screenshot_path]:[];}
 async function prepare(file){
  if(!file||!file.size||file.size>limit)throw error('Alege o imagine JPG, PNG sau WebP de maximum 5 MB.');
  const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const png=[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!jpeg&&!png&&!webp)throw error('Fișierul nu este o imagine JPG, PNG sau WebP validă.');
  let bitmap;
  try{bitmap=await createImageBitmap(file);}catch(_){throw error('Imaginea nu poate fi deschisă. Alege alt fișier.');}
  try{
   if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>25000000)throw error('Imaginea este prea mare. Folosește o captură de maximum 25 megapixeli.');
   const scale=Math.min(1,3840/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
   const ctx=canvas.getContext('2d');ctx.fillStyle='#181919';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
   if(!blob||blob.size>limit)throw error('Imaginea este prea mare după procesare. Alege o captură mai mică.');
   return blob;
  }finally{bitmap.close();}
 }
 function syncInput(){const transfer=new DataTransfer();selected.forEach(item=>transfer.items.add(item.file));input.files=transfer.files;}
 function renderSelection(){
  gallery.replaceChildren();
  const entries=selected.length?selected:[null];
  entries.forEach((item,index)=>{const tile=template.cloneNode(true),image=tile.querySelector('img'),button=tile.querySelector('button');tile.className='report-photo-thumbnail';image.className='report-photo-preview';button.className='report-photo-remove';
   tile.id=index?'':'report-photo-thumbnail';image.id=index?'':'report-photo-preview';button.id=index?'':'report-photo-remove';tile.hidden=!item;image.hidden=!item;button.hidden=!item;
   if(item){image.src=item.url;image.alt='Previzualizare: '+item.file.name;button.setAttribute('aria-label','Elimină captura: '+item.file.name);button.title='Elimină captura';button.disabled=!!pending;
    button.addEventListener('click',()=>{if(pending)return;selectionEpoch++;URL.revokeObjectURL(item.url);selected=selected.filter(entry=>entry!==item);syncInput();hint.textContent='';renderSelection();browse?.focus({preventScroll:true});});}
   gallery.append(tile);
  });
  if(fileLabel)fileLabel.textContent='Capturi de ecran (opțional, max. 5 MB în total)';
 }
 function clearPreview(){selectionEpoch++;selected.forEach(item=>URL.revokeObjectURL(item.url));selected=[];input.value='';hint.textContent='';renderSelection();}
 function addFiles(files){
  const epoch=selectionEpoch;
  selectionTask=selectionTask.then(async()=>{
   if(pending||epoch!==selectionEpoch)return;if(!files.length){syncInput();return;}
   try{
    if(selected.reduce((sum,item)=>sum+item.file.size,0)+files.reduce((sum,file)=>sum+file.size,0)>limit)throw error('Capturile depășesc limita totală de 5 MB. Elimină o imagine sau alege fișiere mai mici.');
    const prepared=[];for(const file of files)prepared.push({file,blob:await prepare(file),id:crypto.randomUUID()});
    if(epoch!==selectionEpoch)return;
    if([...selected,...prepared].reduce((sum,item)=>sum+item.blob.size,0)>limit)throw error('Capturile depășesc limita totală de 5 MB după procesare. Alege imagini mai mici.');
    prepared.forEach(item=>item.url=URL.createObjectURL(item.file));selected.push(...prepared);hint.textContent='';renderSelection();
   }catch(e){hint.textContent=e.message;}
   finally{if(epoch===selectionEpoch)syncInput();}
  });
  return selectionTask;
 }
 input.addEventListener('change',()=>addFiles([...input.files]));
 function thaw(){frozen.forEach(el=>el.disabled=false);frozen=[];lockedEditors.forEach(el=>el.contentEditable='true');lockedEditors=[];input.disabled=false;renderSelection();}
 function freeze(){if(!frozen.length)frozen=[...form.querySelectorAll('input,select,textarea,button:not([type=submit])')].filter(el=>!el.disabled);frozen.forEach(el=>el.disabled=true);lockedEditors=[...form.querySelectorAll('[contenteditable=true]')];lockedEditors.forEach(el=>el.contentEditable='false');}
 function reset(){pending=null;thaw();clearPreview();}
 form.addEventListener('reset',reset);
 window.addEventListener('bg3ro:auth',event=>{if(viewer?.open)viewer.close();if(!event.detail.userId&&!event.detail.guest){reset();input.value='';}});
 window.BG3RO_REPORT_PHOTO={
  async publish(client,payload){
   await selectionTask;
   if(!pending){
    const query=client.from('bg3ro_bug_reports').insert(payload);
    if(!selected.length){const result=await query;if(result.error)throw result.error;return;}
    freeze();let result;try{result=await query.select('id').maybeSingle();}catch(e){thaw();throw e;}
    const {data,error:dbError}=result;if(dbError||!data?.id){thaw();throw dbError||error('Raportarea nu a putut fi publicată.');}
    pending={id:data.id,files:selected.map((item,index)=>({...item,path:data.id+'/'+(index?item.id:'screenshot')+'.jpg',uploaded:false}))};
   }
   if(pending.files.length){
    try{
     for(const item of pending.files){if(item.uploaded)continue;const {error:uploadError}=await client.storage.from(bucket).upload(item.path,item.blob,{contentType:'image/jpeg',upsert:false});
      if(uploadError&&String(uploadError.statusCode||uploadError.status)!=='409'&&!/already exists|duplicate/i.test(uploadError.message||''))throw uploadError;item.uploaded=true;}
     const {error:attachError}=await client.rpc('bg3ro_attach_report_images',{p_report_id:pending.id,p_paths:pending.files.map(item=>item.path)});if(attachError)throw attachError;
    }catch(_){
     throw error('Raportarea este publicată, dar imaginile nu au fost încă atașate. Apasă din nou „Raportează o eroare” pentru a relua încărcarea fără duplicate.');
    }
   }
   pending=null;thaw();
  },
  edit(client,report,form){
   const original=reportPaths(report),kept=new Set(original),controller={original,paths:()=>original.filter(path=>kept.has(path)),locked:false,container:null};
   if(!original.length)return controller;
   const container=document.createElement('div');container.className='report-edit-photos';controller.container=container;
   const label=document.createElement('strong');label.textContent='Capturi de ecran';const note=document.createElement('p');note.className='small';note.textContent='Capturile eliminate vor fi șterse la salvarea modificărilor.';container.append(label,note);
   form.querySelector('.discussion-compose-bottom').before(container);
   this.show(client,report,container,{remove(path,tile){if(controller.locked)return;kept.delete(path);tile.remove();}}).catch(()=>{});
   return controller;
  },
  async saveEdit(client,report,selection,title,body){
   if(!selection.original.length){const {error:writeError}=await client.from('bg3ro_bug_reports').update({title,body}).eq('id',report.id);if(writeError)throw writeError;return;}
   selection.locked=true;selection.container?.querySelectorAll('.report-photo-remove').forEach(button=>button.disabled=true);
   try{
    const {data,error:writeError}=await client.rpc('bg3ro_edit_report_images',{p_report_id:report.id,p_title:title,p_body:body,p_expected_paths:selection.original,p_keep_paths:selection.paths()});
    if(writeError)throw error(writeError.message||'Raportarea nu a putut fi salvată.');
    const removed=Array.isArray(data)?data:[];
    for(let offset=0;offset<removed.length;offset+=1000){const {error:deleteError}=await client.storage.from(bucket).remove(removed.slice(offset,offset+1000));if(deleteError)throw error('Raportarea a fost salvată, dar capturile nu au fost șterse. Apasă din nou „Salvează modificările” pentru a relua ștergerea.');}
   }finally{selection.locked=false;selection.container?.querySelectorAll('.report-photo-remove').forEach(button=>button.disabled=false);}
  },
  async show(client,report,article,editing=null){
   const paths=reportPaths(report);
   if(!paths.length)return;
   const photos=document.createElement('div');photos.className='report-photos';
   const moderation=article.querySelector(':scope > form,:scope > .report-toolbar');if(moderation)moderation.before(photos);else article.append(photos);
   for(const expected of paths){
   if(!expected.startsWith(report.id+'/')||!(/^(screenshot|[0-9a-f-]{36})[.]jpg$/).test(expected.slice(report.id.length+1)))continue;
   let tile=null;
   if(editing){tile=document.createElement('div');tile.className='report-photo-thumbnail';const remove=document.createElement('button');remove.type='button';remove.className='report-photo-remove';remove.textContent='×';remove.setAttribute('aria-label','Elimină captura '+(paths.indexOf(expected)+1));remove.title='Elimină captura';remove.addEventListener('click',()=>editing.remove(expected,tile));tile.append(remove);photos.append(tile);}
   const {data,error:readError}=await client.storage.from(bucket).createSignedUrl(expected,3600);
   if(readError||!data?.signedUrl||!article.isConnected)continue;
   let url;try{url=new URL(data.signedUrl);if(url.origin!==new URL(window.BG3RO_CONFIG.supabaseUrl).origin||!url.pathname.startsWith('/storage/v1/object/sign/'+bucket+'/'))continue;}catch(_){continue;}
   const link=document.createElement('button');link.type='button';link.className='report-photo-link';link.setAttribute('aria-label','Deschide fotografia raportării');link.setAttribute('aria-haspopup','dialog');
   link.addEventListener('click',()=>openPhoto(url.href));
   const image=document.createElement('img');image.src=url.href;image.alt='Fotografie atașată raportării';image.loading='lazy';image.referrerPolicy='no-referrer';
   image.addEventListener('error',()=>link.remove(),{once:true});link.append(image);if(tile)tile.prepend(link);else photos.append(link);
   }
   if(!photos.children.length)photos.remove();
  },
  async cleanup(client,paths){const list=Array.isArray(paths)?paths:paths?[paths]:[];if(list.length)try{await client.storage.from(bucket).remove(list);}catch(_){/* Deleted-report images are no longer publicly readable. */}}
 };
 renderSelection();
})();
