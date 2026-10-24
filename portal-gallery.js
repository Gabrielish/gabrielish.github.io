(() => {
 'use strict';
 const grid=document.querySelector('#project-gallery-grid'),empty=document.querySelector('#gallery-empty'),controls=document.querySelector('#gallery-controls'),input=document.querySelector('#gallery-upload-input'),upload=document.querySelector('#gallery-upload'),status=document.querySelector('#gallery-status');
 if(!grid)return;
 const bucket='bg3ro-gallery';let client=null,admin=false,generation=0,busy=false,rows=[];
 function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
 function url(path){return new URL('/storage/v1/object/public/'+bucket+'/'+path,window.BG3RO_CONFIG.supabaseUrl).href;}
 async function load(){
  if(!client)return;const ticket=++generation,active=client;
  try{const {data,error}=await active.from('bg3ro_gallery_images').select('id,path,alt,created_at').order('created_at',{ascending:true}).order('id',{ascending:true});if(ticket!==generation)return;if(error)throw error;
   rows=(data||[]).filter(row=>/^[0-9a-f-]{36}$/.test(row.id)&&row.path===row.id+'.jpg');grid.replaceChildren();empty.hidden=rows.length>0;
   rows.forEach((row,index)=>{
    const tile=document.createElement('div');tile.className='project-gallery-tile';const open=document.createElement('button');open.type='button';open.className='project-gallery-open';open.setAttribute('aria-label','Deschide imaginea '+(index+1)+' din galerie');open.setAttribute('aria-haspopup','dialog');const image=document.createElement('img');image.src=url(row.path);image.alt=row.alt;image.loading='lazy';image.width=480;image.height=270;open.append(image);open.onclick=()=>window.BG3RO_IMAGE_VIEWER.open(rows.map(item=>({src:url(item.path),alt:item.alt})),index,'Galeria traducerii');tile.append(open);
    if(admin){const remove=document.createElement('button');remove.type='button';remove.className='project-gallery-remove';remove.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';remove.setAttribute('aria-label','Șterge imaginea '+(index+1)+' din galerie');remove.onclick=async()=>{
     if(busy||!admin||!confirm('Ștergi definitiv această imagine din galerie?'))return;busy=true;remove.disabled=true;upload.disabled=true;
     try{const {error:deleteError}=await active.storage.from(bucket).remove([row.path]);if(deleteError)throw deleteError;const {data,error}=await active.from('bg3ro_gallery_images').delete().eq('id',row.id).select('id');if(error||!data?.length)throw error||Error('Not deleted');message('');await load();}
     catch{message('Imaginea nu a putut fi eliminată complet. Încearcă din nou.',true);}finally{busy=false;remove.disabled=false;upload.disabled=false;}
    };tile.append(remove);}grid.append(tile);
   });
  }catch{if(ticket===generation){message('Galeria nu a putut fi încărcată. Încearcă din nou mai târziu.',true);}}
 }
 upload.onclick=()=>{if(admin&&!busy)input.click();};
 input.addEventListener('change',async()=>{
  if(!client||!admin||busy)return;const files=[...input.files];if(!files.length)return;const active=client,ticket=generation;busy=true;upload.disabled=true;message('Se încarcă imaginile…');let completed=0;
  try{for(const file of files){if(!admin||active!==client)throw Error('Session changed');const blob=await window.BG3RO_REPORT_PHOTO.prepareImage(file);if(!admin||active!==client)throw Error('Session changed');const id=crypto.randomUUID(),path=id+'.jpg';const {error:uploadError}=await active.storage.from(bucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});if(uploadError)throw uploadError;
    const {error}=await active.from('bg3ro_gallery_images').insert({id,path,alt:'Captură din traducerea în limba română'});if(error){const check=await active.from('bg3ro_gallery_images').select('id').eq('id',id);if(!check.error&&!check.data?.length)await active.storage.from(bucket).remove([path]);if(check.error||!check.data?.length)throw error;}completed++;
   }message('');
  }catch(error){if(ticket===generation)message((completed?`${completed} imagini încărcate. `:'')+(error.code==='REPORT_PHOTO'?error.message:'Încărcarea nu a fost finalizată. Poți încerca din nou cu imaginile rămase.'),true);}
  finally{input.value='';busy=false;upload.disabled=false;if(active===client)await load();}
 });
 addEventListener('bg3ro:auth',event=>{generation++;client=event.detail.client;admin=event.detail.moderator===true;controls.hidden=!admin;window.BG3RO_IMAGE_VIEWER?.close();if(client)load();});
})();
