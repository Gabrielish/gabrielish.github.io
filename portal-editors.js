(() => {
 'use strict';
 let moderator=false,sequence=0;const dialogs=new Set();
 function mount(source,title,heading){
  for(const dialog of dialogs)if(!dialog.isConnected)dialogs.delete(dialog);
  const wrap=document.createElement('div');wrap.className='edit-control';wrap.id=source.id;wrap.hidden=source.hidden;
  const button=document.createElement('button');button.type='button';button.className='edit-pencil';button.setAttribute('aria-label',title);button.title=title;
  button.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/></svg>';
  const dialog=document.createElement('dialog');dialog.className='edit-dialog';dialog.id=`edit-dialog-${++sequence}`;
  const header=document.createElement('div');header.className='dialog-title';const label=document.createElement('h2');label.id=dialog.id+'-title';label.textContent=title;dialog.setAttribute('aria-labelledby',label.id);
  const close=document.createElement('button');close.type='button';close.className='dialog-close';close.textContent='×';close.setAttribute('aria-label','Închide editarea');header.append(label,close);dialog.append(header);
  [...source.children].filter(n=>n.tagName!=='SUMMARY').forEach(n=>dialog.append(n));button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.id);
  button.onclick=()=>{if(moderator)dialog.showModal();};close.onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{if(button.isConnected&&!wrap.hidden)button.focus({preventScroll:true});});wrap.append(button,dialog);source.replaceWith(wrap);dialogs.add(dialog);
  if(heading){const row=heading.parentElement.classList.contains('card-header')?heading.parentElement:document.createElement('div');if(!row.classList.contains('card-header')){row.className='card-header';heading.before(row);row.append(heading);}row.classList.add('editable-header');row.append(wrap);}return wrap;
 }
 window.BG3RO_EDITORS={mount};
 document.querySelectorAll('#admin-tools>details:not(.inline-update-publish)').forEach(source=>{const title=source.querySelector('summary').textContent,control=mount(source,title),button=control.querySelector('button');button.className='btn';button.replaceChildren(document.createTextNode(title));});
 addEventListener('bg3ro:auth',event=>{moderator=event.detail.moderator===true;if(!moderator)for(const dialog of dialogs){if(dialog.open)dialog.close();if(!dialog.isConnected)dialogs.delete(dialog);}});
})();
