(() => {
 'use strict';
 const pages=[['#erori','Raportare erori','Raportează o eroare'],['#descarcari','Descărcări','Vezi descărcările'],['#discutii','Discuții','Intră în discuție'],['#despre','Despre proiect','Despre proiect'],['#actualizari','Actualizări','Vezi actualizările'],['#contact','Contact','Contact'],['#intrebari-frecvente','Întrebări frecvente','Întrebări frecvente']];
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function destination(value){
  if(pages.some(([hash])=>hash===value))return value;
  try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
   if((url.origin===location.origin||url.origin==='https://gabrielish.github.io')&&url.pathname==='/'&&pages.some(([hash])=>hash===url.hash))return url.hash;
   return url.href;
  }catch(_){return null;}
 }
 function inline(target,text){
  const tokens=/\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*/g;let start=0;
  for(const match of text.matchAll(tokens)){
   target.append(document.createTextNode(text.slice(start,match.index)));
   if(match[3])target.append(node('strong',match[3]));
   else{
    const href=destination(match[2]);
    if(href){const a=node('a',match[1]);a.href=href;
     if(href.startsWith('#'))a.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();const nav=document.querySelector('[data-go-tab="'+href.slice(1)+'"]')||document.querySelector('#tab-'+href.slice(1));if(nav)nav.click();else location.hash=href;document.querySelector('.tab-list')?.scrollIntoView({block:'start',behavior:'instant'});});
     else{a.target='_blank';a.rel='noopener noreferrer';}
     target.append(a);
    }else target.append(document.createTextNode(match[0]));
   }
   start=match.index+match[0].length;
  }
  target.append(document.createTextNode(text.slice(start)));
 }
 function render(text){
  const body=node('div');body.className='post-body rich-content';let paragraph=null,list=null;
  for(const line of String(text||'').split(/\r?\n/)){
   const bullet=line.match(/^\s*[-*•]\s+(.+)$/);
   if(bullet){paragraph=null;if(!list){list=node('ul');body.append(list);}const li=node('li');inline(li,bullet[1]);list.append(li);}
   else if(!line.trim()){paragraph=null;list=null;}
   else{list=null;if(!paragraph){paragraph=node('p');body.append(paragraph);}else paragraph.append(node('br'));inline(paragraph,line);}
  }
  return body;
 }
 function enhance(textarea){
  if(!textarea||textarea.dataset.contentTools)return;textarea.dataset.contentTools='true';
  const toolbar=node('div');toolbar.className='content-toolbar';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Formatarea conținutului');
  const button=text=>{const b=node('button',text);b.type='button';b.className='btn secondary small-btn';return b;};
  const bullets=button('Listă cu puncte'),link=button('Adaugă link');toolbar.append(bullets,link);textarea.before(toolbar);
  function insert(text,start=textarea.selectionStart,end=textarea.selectionEnd){
   if(textarea.value.length-end+start+text.length>textarea.maxLength)return false;
   textarea.setRangeText(text,start,end,'end');textarea.dispatchEvent(new Event('input',{bubbles:true}));textarea.focus();return true;
  }
  bullets.addEventListener('click',()=>{
   const start=textarea.value.lastIndexOf('\n',Math.max(0,textarea.selectionStart-1))+1;
   let end=textarea.value.indexOf('\n',textarea.selectionEnd);if(end<0)end=textarea.value.length;
   const lines=textarea.value.slice(start,end).split('\n'),remove=lines.every(line=>/^\s*[-*•]\s+/.test(line));
   insert(lines.map(line=>remove?line.replace(/^\s*[-*•]\s+/,''):'• '+line.replace(/^\s*[-*•]\s+/,'')).join('\n'),start,end);
  });
  const panel=node('div');panel.className='content-link-panel';panel.hidden=true;
  const make=(text,input)=>{const wrap=node('div');wrap.className='field';const label=node('label',text);input.id='content-link-'+(++enhance.sequence);label.htmlFor=input.id;wrap.append(label,input);panel.append(wrap);return input;};
  const label=make('Textul linkului',node('input'));label.maxLength=160;
  const select=make('Destinație',node('select'));pages.forEach(([hash,title])=>{const option=node('option',title);option.value=hash;select.append(option);});
  const external=node('option','Adresă web externă');external.value='external';select.append(external);
  const address=make('Adresa web',node('input'));address.type='url';address.maxLength=2000;address.placeholder='https://…';address.parentElement.hidden=true;address.disabled=true;
  const actions=node('div');actions.className='content-link-actions';const add=button('Inserează linkul'),cancel=button('Anulează');actions.append(add,cancel);panel.append(actions);
  const status=node('p');status.className='form-status';status.setAttribute('role','status');panel.append(status);textarea.after(panel);
  link.setAttribute('aria-expanded','false');link.setAttribute('aria-controls',panel.id='content-link-panel-'+(++enhance.sequence));
  let range=[0,0];
  const close=()=>{panel.hidden=true;address.disabled=true;link.setAttribute('aria-expanded','false');};
  link.addEventListener('click',()=>{range=[textarea.selectionStart,textarea.selectionEnd];label.value=textarea.value.slice(...range)||'Raportează o eroare';select.value='#erori';address.value='';address.parentElement.hidden=true;address.disabled=true;status.textContent='';panel.hidden=false;link.setAttribute('aria-expanded','true');label.focus();});
  select.addEventListener('change',()=>{address.parentElement.hidden=select.value!=='external';address.disabled=select.value!=='external';if(select.value!=='external')label.value=pages.find(([hash])=>hash===select.value)[2];});
  cancel.addEventListener('click',()=>{close();link.focus();});
  add.addEventListener('click',()=>{const href=destination(select.value==='external'?address.value.trim():select.value),text=label.value.trim();
   if(!href||!text||/[\[\]\r\n]/.test(text)||/[()\s]/.test(href)){status.textContent='Completează textul și o adresă validă pentru link.';return;}
   if(insert('['+text+']('+href+')',...range))close();else status.textContent='Conținutul depășește limita de caractere.';
  });
 }
 enhance.sequence=0;
 window.BG3RO_CONTENT={render,enhance};
 enhance(document.querySelector('#update-body'));
})();
