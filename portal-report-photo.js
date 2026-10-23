(() => {
 'use strict';
 const form=document.querySelector('#report-form'),input=document.querySelector('#report-photo');
 if(!form||!input)return;
 const preview=document.querySelector('#report-photo-preview'),remove=document.querySelector('#report-photo-remove'),hint=document.querySelector('#report-photo-status');
 const drop=document.querySelector('#report-photo-drop'),browse=document.querySelector('#report-photo-browse'),fileLabel=document.querySelector('#report-photo-label');
 if(browse)browse.addEventListener('click',()=>{if(!input.disabled)input.click();});
 if(drop){
  ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();if(!input.disabled)drop.classList.add('drag-over');}));
  ['dragleave','drop'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('drag-over');}));
  drop.addEventListener('drop',e=>{if(input.disabled)return;if(e.dataTransfer.files.length!==1){hint.textContent='Alege o singură fotografie.';return;}input.files=e.dataTransfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
 }
 const bucket='bg3ro-report-images',limit=5*1024*1024;
 let previewURL,pending=null,frozen=[];
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
 function clearPreview(){if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;preview.removeAttribute('src');preview.hidden=true;remove.hidden=true;hint.textContent='';if(fileLabel)fileLabel.textContent='Captură de ecran (opțional, max. 5 MB)';}
 input.addEventListener('change',async()=>{
  clearPreview();const file=input.files[0];if(!file)return;
  try{await prepare(file);if(input.files[0]!==file)return;previewURL=URL.createObjectURL(file);preview.src=previewURL;preview.hidden=false;remove.hidden=false;if(fileLabel)fileLabel.textContent=file.name;}
  catch(e){if(input.files[0]===file){input.value='';hint.textContent=e.message;}}
 });
 remove.addEventListener('click',()=>{input.value='';clearPreview();});
 function thaw(){frozen.forEach(el=>el.disabled=false);frozen=[];}
 function reset(){pending=null;thaw();clearPreview();input.disabled=false;remove.disabled=false;}
 form.addEventListener('reset',reset);
 window.addEventListener('bg3ro:auth',event=>{if(viewer?.open)viewer.close();if(!event.detail.userId&&!event.detail.guest){reset();input.value='';}});
 window.BG3RO_REPORT_PHOTO={
  async publish(client,payload){
   const file=input.files[0],blob=file?await prepare(file):null;
   if(!pending){
    const query=client.from('bg3ro_bug_reports').insert(payload);
    if(!blob){const result=await query;if(result.error)throw result.error;return;}
    const {data,error:dbError}=await query.select('id').maybeSingle();if(dbError||!data?.id)throw dbError||error('Raportarea nu a putut fi publicată.');
    pending={id:data.id,uploaded:false};
   }
   if(blob){
    const path=pending.id+'/screenshot.jpg';
    try{
     if(!pending.uploaded){const {error:uploadError}=await client.storage.from(bucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});if(uploadError)throw uploadError;pending.uploaded=true;input.disabled=true;remove.disabled=true;}
     const {error:attachError}=await client.rpc('bg3ro_attach_report_image',{p_report_id:pending.id});if(attachError)throw attachError;
    }catch(_){
     if(!frozen.length)frozen=[...form.querySelectorAll('input:not([type=file]),select,textarea')].filter(el=>!el.disabled);frozen.forEach(el=>el.disabled=true);
     throw error('Raportarea este publicată, dar fotografia nu a fost atașată. Apasă din nou „Publică raportarea” pentru a reîncerca fără să creezi un duplicat.');
    }
   }
   pending=null;thaw();input.disabled=false;remove.disabled=false;
  },
  async show(client,report,article){
   if(!report.screenshot_path)return;
   const expected=report.id+'/screenshot.jpg';if(report.screenshot_path!==expected)return;
   const {data,error:readError}=await client.storage.from(bucket).createSignedUrl(expected,3600);
   if(readError||!data?.signedUrl||!article.isConnected)return;
   let url;try{url=new URL(data.signedUrl);if(url.origin!==new URL(window.BG3RO_CONFIG.supabaseUrl).origin||!url.pathname.startsWith('/storage/v1/object/sign/'+bucket+'/'))return;}catch(_){return;}
   const link=document.createElement('button');link.type='button';link.className='report-photo-link';link.setAttribute('aria-label','Deschide fotografia raportării');link.setAttribute('aria-haspopup','dialog');
   link.addEventListener('click',()=>openPhoto(url.href));
   const image=document.createElement('img');image.src=url.href;image.alt='Fotografie atașată raportării';image.loading='lazy';image.referrerPolicy='no-referrer';
   image.addEventListener('error',()=>link.remove(),{once:true});link.append(image);const moderation=article.querySelector(':scope > form,:scope > .report-toolbar');if(moderation)moderation.before(link);else article.append(link);
  },
  async cleanup(client,path){if(path)try{await client.storage.from(bucket).remove([path]);}catch(_){/* Deleted-report images are no longer publicly readable. */}}
 };
})();
