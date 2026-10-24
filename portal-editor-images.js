(() => {
 'use strict';
 let client=null,userId=null,generation=0;
 addEventListener('bg3ro:auth',event=>{client=event.detail.client;userId=event.detail.userId;generation++;});
 window.BG3RO_EDITOR_IMAGES={
  canUpload:form=>!!client&&!!userId&&!form.closest('#conversatii'),
  async upload(file,form){
   if(!this.canUpload(form))throw Error('Conectează-te prin Discord pentru a încărca imagini.');
   const active=client,id=userId,ticket=generation,blob=await window.BG3RO_REPORT_PHOTO.prepareImage(file);
   if(ticket!==generation)throw Error('Sesiunea s-a schimbat. Încearcă din nou.');
   const path=id+'/'+crypto.randomUUID()+'.jpg',bucket='bg3ro-editor-images';
   const {error}=await active.storage.from(bucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});
   if(error)throw Error('Imaginea nu a putut fi încărcată. Încearcă din nou.');
   if(ticket!==generation)throw Error('Sesiunea s-a schimbat. Încearcă din nou.');
   return {src:new URL('/storage/v1/object/public/'+bucket+'/'+path,window.BG3RO_CONFIG.supabaseUrl).href,alt:'Imagine atașată'};
  }
 };
})();
