(() => {
 'use strict';
 let dialog,image,counter,previous,next,items=[],index=0,origin=null;
 function draw(){const item=items[index];if(!item)return;image.src=item.src;image.alt=item.alt||'Imagine mărită';counter.textContent=`${index+1} / ${items.length}`;previous.hidden=next.hidden=items.length<2;}
 function step(delta){if(items.length>1){index=(index+delta+items.length)%items.length;draw();}}
 function create(){
  dialog=document.createElement('dialog');dialog.className='image-viewer report-photo-viewer';dialog.setAttribute('aria-label','Vizualizator de imagini');
  const button=(label,path,cls)=>{const b=document.createElement('button');b.type='button';b.className=cls;b.setAttribute('aria-label',label);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',path);svg.append(p);b.append(svg);return b;};
  const close=button('Închide fotografia','M6 6l12 12M18 6 6 18','image-viewer-close dialog-close');close.autofocus=true;close.onclick=()=>dialog.close();
  previous=button('Imaginea precedentă','m15 6-6 6 6 6','image-viewer-previous');next=button('Imaginea următoare','m9 6 6 6-6 6','image-viewer-next');previous.onclick=()=>step(-1);next.onclick=()=>step(1);
  image=document.createElement('img');image.referrerPolicy='no-referrer';image.draggable=false;
  counter=document.createElement('span');counter.className='image-viewer-counter';counter.setAttribute('role','status');counter.setAttribute('aria-live','polite');
  dialog.append(image,close,previous,next,counter);document.body.append(dialog);
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();step(event.key==='ArrowLeft'?-1:1);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();index=event.key==='Home'?0:items.length-1;draw();}});
  let start=null;image.addEventListener('touchstart',event=>{if(event.touches.length===1)start={x:event.touches[0].clientX,y:event.touches[0].clientY};},{passive:true});image.addEventListener('touchend',event=>{if(start&&event.changedTouches.length){const dx=event.changedTouches[0].clientX-start.x,dy=event.changedTouches[0].clientY-start.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);}start=null;},{passive:true});
  dialog.addEventListener('close',()=>{if(dialog.open)return;image.removeAttribute('src');items=[];if(origin?.isConnected)origin.focus({preventScroll:true});origin=null;});
 }
 window.BG3RO_IMAGE_VIEWER={open(images,at=0,label='Galerie de imagini'){
  const valid=images.filter(item=>{try{return ['https:','http:','blob:'].includes(new URL(item.src,location.href).protocol);}catch{return false;}});if(!valid.length)return;
  if(!dialog)create();origin=document.activeElement;items=valid;index=Math.max(0,Math.min(at,items.length-1));dialog.setAttribute('aria-label',label);draw();if(!dialog.open)dialog.showModal();
 },close(){if(dialog?.open)dialog.close();}};
})();
