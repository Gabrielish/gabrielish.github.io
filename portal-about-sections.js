(() => {
 'use strict';
 const root=document.querySelector('#despre');if(!root)return;
 const builtins=new Map([['progress',root.querySelector('.progress-card')],['about',root.querySelector('.about-copy')],['work',root.querySelector('#current-work')],['modules',root.querySelector(':scope>article:not(.about-copy)')],['gallery',root.querySelector('#project-gallery')]]);
 const cards=new Map(),originals=new Map();let client=null,admin=false,epoch=0,busy=false,rows=[],editing=null,sequence=0,ready=false;
 const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const paths={edit:'m16 3 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15l-1 6Z',hide:'M3 3l18 18M10 5c5-1 9 3 11 7a18 18 0 0 1-4 5M7 7a20 20 0 0 0-6 5c3 5 8 8 13 6',show:'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Zm14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',delete:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',add:'M12 5v14M5 12h14',up:'M12 20V4m-6 6 6-6 6 6',down:'M12 4v16m-6-6 6 6 6-6'};
 function button(text,kind,action){const b=node('button','btn about-section-action');b.type='button';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':true}))svg.setAttribute(key,value);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[kind]);svg.append(path);b.append(svg,node('span','',text));b.onclick=action;return b;}
 const management=node('div','about-management'),add=button('Adaugă o rubrică','add',()=>openEditor(null)),status=node('p','form-status'),retry=node('button','btn secondary small-btn','Reîncearcă');status.setAttribute('role','status');retry.type='button';retry.onclick=()=>load();retry.hidden=add.hidden=management.hidden=true;management.append(add,status,retry);root.append(management);
 function setup(id,card){const heading=card.querySelector('h2'),content=node('div','about-section-content');
  if(id==='progress'||id==='gallery'){const head=heading.closest('.card-header,.project-gallery-header');head.after(content);}else{[...card.children].filter(n=>n!==heading).forEach(n=>content.append(n));card.append(content);}
  originals.set(id,[...content.childNodes].map(n=>n.cloneNode(true)));card.dataset.aboutSection=id;card.hidden=true;cards.set(id,{card,heading,content});return cards.get(id);
 }
 for(const [id,card]of builtins)setup(id,card);
 const loading=node('div','card about-loading');loading.setAttribute('role','status');loading.append(node('p','','Se încarcă informațiile proiectului…'));for(let i=0;i<3;i++)loading.append(node('span','about-loading-line'));root.insertBefore(loading,management);root.setAttribute('aria-busy','true');
 function loaded(){ready=true;loading.hidden=true;root.setAttribute('aria-busy','false');}
 if(window.BG3RO_PUBLIC_ABOUT)window.BG3RO_PUBLIC_ABOUT.then(data=>{if(!ready&&data){rows=data;draw(false);loaded();message('');}});
 function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);management.hidden=!admin&&!text;}
 function closeEditor(focus=true){if(!editing)return;const {form,api,trigger}=editing;api?.destroy();form.remove();editing=null;add.hidden=!admin;for(const tools of root.querySelectorAll('.about-section-tools'))tools.hidden=!admin;if(focus&&admin&&trigger?.isConnected)trigger.focus({preventScroll:true});}
 function discard(){if(!editing)return true;if(editing.dirty&&!confirm('Renunți la modificările nesalvate?'))return false;closeEditor(false);return true;}
 function draw(manage=admin){
  const present=new Set(rows.map(r=>r.id));for(const [id,view]of cards){view.card.hidden=!present.has(id);view.card.querySelector('.about-section-tools')?.remove();if(!present.has(id)&&!builtins.has(id)){view.card.remove();cards.delete(id);originals.delete(id);}}
  for(const [position,row]of rows.entries()){let view=cards.get(row.id);if(!view){const card=node('article','card'),heading=node('h2');card.append(heading);root.insertBefore(card,management);view=setup(row.id,card);}const {card,heading,content}=view;card.hidden=!row.is_visible&&!admin;card.classList.toggle('is-section-hidden',!row.is_visible);card.classList.toggle('is-content-hidden',!row.is_visible);heading.textContent=row.title;
   if(row.body===null)content.replaceChildren(...originals.get(row.id).map(n=>n.cloneNode(true)));else content.replaceChildren(window.BG3RO_CONTENT.render(row.body));
   if(row.legacy_note?.trim()){const quote=node('blockquote');quote.append(node('p','',row.legacy_note));content.append(quote);}
   if(row.kind==='progress')for(const kind of ['translation','review','testing']){const value=Math.max(0,Math.min(100,Number(row[kind+'_percent']))),bar=card.querySelector('#'+kind+'-progress');card.querySelector('#'+kind+'-percent').textContent=value+'%';bar.setAttribute('aria-valuenow',String(value));bar.querySelector('.progress-fill').style.width=value+'%';}
   if(row.kind==='gallery')galleryImages(view,row,manage);
   if(manage){const tools=node('div','about-section-tools'),edit=button('Editează','edit',()=>openEditor(row)),visibility=button(row.is_visible?'Ascunde':'Afișează',row.is_visible?'hide':'show',()=>change(row,{is_visible:!row.is_visible})),remove=button('Șterge','delete',()=>removeSection(row));edit.setAttribute('aria-label','Editează '+row.title);visibility.setAttribute('aria-label',(row.is_visible?'Ascunde ':'Afișează ')+row.title);remove.setAttribute('aria-label','Șterge '+row.title);tools.append(edit,visibility,remove);card.append(tools);}
   if(manage){const tools=card.querySelector('.about-section-tools');for(const [delta,label,kind,edge]of [[-1,'Mai sus','up',position===0],[1,'Mai jos','down',position===rows.length-1]]){const move=button(label,kind,()=>moveSection(row,delta));move.dataset.move=delta;move.dataset.atEdge=String(edge);move.disabled=edge;move.setAttribute('aria-label','Mută '+row.title+' '+label.toLowerCase());tools.append(move);}}
   root.insertBefore(card,management);
  }
  add.hidden=!manage;retry.hidden=true;
 }
 function galleryImages(view,row,manage){
  const prefix='BG3RO-RICH-1:';if(!row.body?.startsWith(prefix))return;
  let doc;try{doc=JSON.parse(row.body.slice(prefix.length));}catch{return;}
  const slots=[];function walk(parent){for(const [index,item]of (parent.content||[]).entries()){if(item.type==='image')slots.push({parent,index,item});else walk(item);}}walk(doc);
  view.content.classList.add('project-gallery-rich');let dragIndex=null;
  async function save(from,to,remove=false){
   if(busy||!admin||editing||!slots[from]||(!remove&&!slots[to]))return;
   if(remove&&!confirm('Elimini această imagine din galerie?'))return;
   const next=JSON.parse(JSON.stringify(doc)),nextSlots=[];function collect(parent){for(const [index,item]of (parent.content||[]).entries()){if(item.type==='image')nextSlots.push({parent,index,item});else collect(item);}}collect(next);
   if(remove){const slot=nextSlots[from];slot.parent.content.splice(slot.index,1);}else{const ordered=nextSlots.map(slot=>slot.item);ordered.splice(to,0,ordered.splice(from,1)[0]);nextSlots.forEach((slot,index)=>{slot.parent.content[slot.index]=ordered[index];});}
   const body=prefix+JSON.stringify(next),ticket=epoch,active=client;busy=true;view.card.setAttribute('aria-busy','true');message('Se salvează galeria…');
   try{const {data,error}=await active.rpc('bg3ro_update_gallery_body',{p_expected:row.body,p_body:body});if(error||data!==true)throw error||Error('Gallery changed');if(ticket===epoch){await load();message(remove?'Imaginea a fost eliminată din galerie.':'Ordinea imaginilor a fost salvată.');}}
   catch{if(ticket===epoch){message('Modificarea nu a fost salvată. Reîncarcă rubricile și încearcă din nou.',true);retry.hidden=false;}}
   finally{busy=false;view.card.removeAttribute('aria-busy');}
  }
  const used=new Set();for(const image of view.content.querySelectorAll('.discussion-inline-image')){
   const index=slots.findIndex((slot,i)=>!used.has(i)&&slot.item.attrs?.src===image.getAttribute('src'));if(index<0)continue;used.add(index);
   const tile=node('div','project-gallery-tile project-gallery-rich-tile');tile.dataset.galleryIndex=index;image.before(tile);tile.append(image);image.draggable=manage;
   if(!manage)continue;
   tile.draggable=true;tile.title='Trage imaginea pentru a schimba ordinea. Prima imagine este principală.';
   const remove=button('','delete',()=>save(index,index,true));remove.className='project-gallery-remove';remove.setAttribute('aria-label','Șterge imaginea '+(index+1)+' din galerie');remove.title='Șterge imaginea';remove.querySelector('path').setAttribute('d','m6 6 12 12M18 6 6 18');remove.querySelector('svg').setAttribute('width','14');remove.querySelector('svg').setAttribute('height','14');tile.append(remove);
   if(index===0)tile.append(node('span','gallery-primary','Principală'));
   const handle=button('','up',()=>{});handle.className='gallery-drag-handle';handle.setAttribute('aria-label','Reordonează imaginea '+(index+1)+'; Alt și săgeți pentru mutare');handle.setAttribute('aria-keyshortcuts','Alt+ArrowLeft Alt+ArrowRight');handle.title='Trage pentru reordonare';handle.querySelector('path').setAttribute('d','M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01');tile.append(handle);
   handle.onkeydown=event=>{if(event.altKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();save(index,index+(event.key==='ArrowRight'?1:-1));}};
   tile.ondragstart=event=>{if(busy||editing||!admin){event.preventDefault();return;}dragIndex=index;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(index));tile.classList.add('is-dragging');};
   tile.ondragover=event=>{if(dragIndex!==null&&!busy&&admin){event.preventDefault();event.dataTransfer.dropEffect='move';tile.classList.add('is-drop-target');}};
   tile.ondragleave=()=>tile.classList.remove('is-drop-target');
   tile.ondrop=event=>{event.preventDefault();tile.classList.remove('is-drop-target');if(dragIndex!==null&&dragIndex!==index)save(dragIndex,index);dragIndex=null;};
   tile.ondragend=()=>{dragIndex=null;view.content.querySelectorAll('.is-dragging,.is-drop-target').forEach(el=>el.classList.remove('is-dragging','is-drop-target'));};
   let pointer=null,target=index;
   handle.onpointerdown=event=>{if(event.button!==0||busy||editing||!admin)return;event.preventDefault();pointer=event.pointerId;target=index;handle.setPointerCapture(pointer);tile.classList.add('is-dragging');};
   handle.onpointermove=event=>{if(pointer!==event.pointerId)return;const over=document.elementFromPoint(event.clientX,event.clientY)?.closest('.project-gallery-rich-tile');view.content.querySelectorAll('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));if(over&&view.content.contains(over)){target=Number(over.dataset.galleryIndex);over.classList.add('is-drop-target');}};
   const end=event=>{if(pointer!==event.pointerId)return;const cancelled=event.type==='pointercancel';pointer=null;tile.classList.remove('is-dragging');view.content.querySelectorAll('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));if(!cancelled&&target!==index)save(index,target);};handle.onpointerup=end;handle.onpointercancel=end;
  }
 }
 async function load(){if(!client)return;const ticket=++epoch,active=client;try{const {data,error}=await active.from('bg3ro_about_sections').select('*').order('sort_order').order('id');if(ticket!==epoch)return;if(error)throw error;rows=data||[];draw();loaded();message('');}catch{if(ticket===epoch){loading.hidden=true;root.setAttribute('aria-busy','false');message('Rubricile nu au putut fi încărcate. Încearcă din nou.',true);retry.hidden=false;}}}
 async function change(row,values){if(busy||!admin||!discard())return;const ticket=epoch,active=client;busy=true;message('Se salvează…');try{const {data,error}=await active.from('bg3ro_about_sections').update(values).eq('id',row.id).select('id').maybeSingle();if(error||!data)throw error||Error('Not saved');if(ticket===epoch)await load();}catch{if(ticket===epoch)message('Modificarea nu a fost salvată. Încearcă din nou.',true);}finally{busy=false;}}
 async function moveSection(row,delta){
  if(busy||!admin||!discard())return;const position=rows.findIndex(item=>item.id===row.id),target=position+delta;if(position<0||target<0||target>=rows.length)return;
  const expected=rows.map(item=>item.id),ordered=[...expected];ordered.splice(target,0,ordered.splice(position,1)[0]);const ticket=epoch,active=client;busy=true;for(const b of root.querySelectorAll('[data-move]'))b.disabled=true;message('Se salvează ordinea…');
  try{const {data,error}=await active.rpc('bg3ro_reorder_about_sections',{p_ids:ordered,p_expected:expected});if(error||data!==true)throw error||Error('Not reordered');if(ticket===epoch){await load();if(admin&&client===active){message('Ordinea rubricilor a fost salvată.');const card=cards.get(row.id)?.card;(card?.querySelector('[data-move="'+delta+'"]:not(:disabled)')||card?.querySelector('[data-move]:not(:disabled)'))?.focus({preventScroll:true});}}}
  catch{if(ticket===epoch){message('Ordinea nu a fost salvată. Reîncarcă rubricile și încearcă din nou.',true);retry.hidden=false;}}
  finally{busy=false;for(const b of root.querySelectorAll('[data-move]'))b.disabled=b.dataset.atEdge==='true';}
 }
 async function removeSection(row){if(busy||!admin||!discard())return;const text=row.kind==='gallery'?'Ștergi rubrica Galerie? Fotografiile nu vor fi șterse din stocare.':'Ștergi definitiv rubrica „'+row.title+'”?';if(!confirm(text))return;const ticket=epoch,active=client;busy=true;message('Se șterge…');try{const {data,error}=await active.from('bg3ro_about_sections').delete().eq('id',row.id).select('id');if(error||!data?.length)throw error||Error('Not deleted');if(ticket===epoch){await load();add.focus({preventScroll:true});}}catch{if(ticket===epoch)message('Rubrica nu a fost ștearsă. Încearcă din nou.',true);}finally{busy=false;}}
 function field(form,name,label,type,value,max){const wrap=node('div','field'),caption=node('label','',label),input=node(type==='textarea'?'textarea':'input');input.id='about-section-field-'+(++sequence);input.name=name;caption.htmlFor=input.id;input.value=value??'';if(type!=='textarea')input.type=type;if(max)input.maxLength=max;input.required=type!=='textarea';wrap.append(caption,input);form.append(wrap);return input;}
 function openEditor(row){
  if(busy||!admin||!discard())return;message('');const form=node('form','about-section-editor'),title=field(form,'title','Titlu','text',row?.title,120),textarea=field(form,'body','Conținut','textarea',row?.body||'',12000);form.setAttribute('aria-label',row?'Editează '+row.title:'Adaugă o rubrică');
  if(row?.kind==='progress'){const fields=node('div','form-grid');for(const [kind,label]of [['translation','Traducere (%)'],['review','Corectare (%)'],['testing','Testare (%)']]){const input=field(fields,kind+'_percent',label,'number',row[kind+'_percent']);input.min=0;input.max=100;input.step='0.01';input.inputMode='decimal';}form.append(fields);}
  const end=node('div','form-end'),save=node('button','btn','Salvează'),cancel=node('button','btn about-section-cancel','Anulează'),localStatus=node('p','form-status');save.type='submit';cancel.type='button';localStatus.setAttribute('role','status');end.append(cancel,save);form.append(end,localStatus);const view=row?cards.get(row.id):null,trigger=row?view.card.querySelector('.about-section-tools>button'):add;(view?.card||management).append(form);
  if(!window.BG3RO_MOUNT_CONTENT_EDITOR){form.remove();message('Editorul nu s-a încărcat. Reîncarcă pagina pentru a păstra formatarea.',true);return;}
  const api=window.BG3RO_MOUNT_CONTENT_EDITOR(form,textarea,{minimum:row&&row.kind!=='text'?0:1,label:'Conținutul rubricii',placeholder:'Scrie conținutul rubricii…'});
  if(row?.body===null){const content=view.content.cloneNode(true);content.querySelectorAll('.module-row').forEach((module,index)=>{if(index)module.before(document.createElement('hr'));});content.querySelectorAll('.mini-badge').forEach(badge=>badge.remove());api.editor.commands.setContent(content.innerHTML);}
  if(row?.legacy_note?.trim())api.editor.commands.insertContentAt(api.editor.state.doc.content.size,{type:'blockquote',content:[{type:'paragraph',content:[{type:'text',text:row.legacy_note}]}]});
  editing={form,api,trigger,dirty:false};form.addEventListener('input',()=>{if(editing?.form===form)editing.dirty=true;});api.editor.on('update',()=>{if(editing?.form===form)editing.dirty=true;});for(const tools of root.querySelectorAll('.about-section-tools'))tools.hidden=true;add.hidden=true;cancel.onclick=()=>closeEditor();title.focus({preventScroll:true});
  form.onsubmit=async event=>{event.preventDefault();if(busy||!admin||editing?.form!==form)return;const ticket=epoch,active=client;let values;
   try{values={title:title.value.trim(),body:api.value()};if(!values.title)throw Error('Completează titlul.');if(row){values.legacy_note='';if(row.kind==='progress')for(const kind of ['translation','review','testing'])values[kind+'_percent']=Number(form.elements[kind+'_percent'].value);}else values.sort_order=Math.min(1000000,Math.max(0,...rows.map(r=>r.sort_order))+10);}catch(error){localStatus.classList.add('error');localStatus.textContent=error.message;return;}
   busy=true;form.inert=true;save.disabled=cancel.disabled=true;localStatus.classList.remove('error');localStatus.textContent='Se salvează…';
   try{let request=active.from('bg3ro_about_sections');request=row?request.update(values).eq('id',row.id):request.insert(values);const {data,error}=await request.select('*').maybeSingle();if(error||!data)throw error||Error('Not saved');if(ticket===epoch){closeEditor(false);await load();(cards.get(data.id)?.card.querySelector('.about-section-tools>button')||add).focus({preventScroll:true});}}
   catch{if(ticket===epoch){localStatus.classList.add('error');localStatus.textContent='Rubrica nu a fost salvată. Textul a fost păstrat; încearcă din nou.';}}
   finally{busy=false;form.inert=false;save.disabled=cancel.disabled=false;}
  };
 }
 addEventListener('bg3ro:auth',event=>{const wasAdmin=admin;epoch++;closeEditor(false);client=event.detail.client;admin=event.detail.moderator===true;add.hidden=true;for(const {card}of cards.values()){card.querySelector('.about-section-tools')?.remove();if(card.classList.contains('is-section-hidden'))card.hidden=true;}if(!admin&&wasAdmin){rows=rows.filter(row=>row.is_visible);draw();}if(client){if(admin||wasAdmin||!ready)load();}else if(!ready){loading.hidden=true;root.setAttribute('aria-busy','false');message('Rubricile nu sunt disponibile momentan.',true);}});
})();
