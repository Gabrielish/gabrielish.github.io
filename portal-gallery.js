(() => {
 'use strict';
 const grid=document.querySelector('#project-gallery-grid'),status=document.querySelector('#gallery-status');
 if(!grid)return;
 const bucket='bg3ro-gallery';let client=null,admin=false,generation=0,busy=false,rows=[];
 const section=grid.closest('.project-gallery');
 const sources=()=>[...section.querySelectorAll('.about-section-content .discussion-inline-image,.project-gallery-open img')];
 function openImages(event){const target=event.target.closest('.project-gallery-open,.about-section-content .discussion-inline-image');if(!target)return;if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopImmediatePropagation();const image=target.tagName==='IMG'?target:target.querySelector('img'),images=sources();window.BG3RO_IMAGE_VIEWER.open(images.map(item=>({src:item.src,alt:item.alt})),images.indexOf(image),'Galeria traducerii');}
 section.addEventListener('click',openImages,true);section.addEventListener('keydown',openImages,true);
 function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
 function url(path){return new URL('/storage/v1/object/public/'+bucket+'/'+path,window.BG3RO_CONFIG.supabaseUrl).href;}
 async function load(){
  if(!client)return;const ticket=++generation,active=client;
  try{const {data,error}=await active.from('bg3ro_gallery_images').select('id,path,alt,created_at').order('created_at',{ascending:true}).order('id',{ascending:true});if(ticket!==generation)return;if(error)throw error;
   rows=(data||[]).filter(row=>/^[0-9a-f-]{36}$/.test(row.id)&&row.path===row.id+'.jpg');grid.replaceChildren();
   rows.forEach((row,index)=>{
    const tile=document.createElement('div');tile.className='project-gallery-tile';const open=document.createElement('button');open.type='button';open.className='project-gallery-open';open.setAttribute('aria-label','Deschide imaginea '+(index+1)+' din galerie');open.setAttribute('aria-haspopup','dialog');const image=document.createElement('img');image.src=url(row.path);image.alt=row.alt;image.loading='lazy';image.width=480;image.height=270;open.append(image);open.onclick=()=>window.BG3RO_IMAGE_VIEWER.open(rows.map(item=>({src:url(item.path),alt:item.alt})),index,'Galeria traducerii');tile.append(open);
    if(admin){const remove=document.createElement('button');remove.type='button';remove.className='project-gallery-remove';remove.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';remove.setAttribute('aria-label','Șterge imaginea '+(index+1)+' din galerie');remove.onclick=async()=>{
     if(busy||!admin||!confirm('Ștergi definitiv această imagine din galerie?'))return;busy=true;remove.disabled=true;
     try{const {error:deleteError}=await active.storage.from(bucket).remove([row.path]);if(deleteError)throw deleteError;const {data,error}=await active.from('bg3ro_gallery_images').delete().eq('id',row.id).select('id');if(error||!data?.length)throw error||Error('Not deleted');message('');await load();}
     catch{message('Imaginea nu a putut fi eliminată complet. Încearcă din nou.',true);}finally{busy=false;remove.disabled=false;}
    };tile.append(remove);}grid.append(tile);
   });
  }catch{if(ticket===generation){message('Galeria nu a putut fi încărcată. Încearcă din nou mai târziu.',true);}}
 }
 addEventListener('bg3ro:auth',event=>{generation++;client=event.detail.client;admin=event.detail.moderator===true;window.BG3RO_IMAGE_VIEWER?.close();if(client)load();});
})();
