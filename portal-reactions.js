(() => {
 'use strict';
 const choices=[['like','👍','Îmi place'],['love','❤️','Ador'],['laugh','😂','Amuzant'],['wow','😮','Uimitor'],['sad','😢','Trist'],['angry','😡','Supărat']];
 const mounted=new Map();let client=null,canReact=false,generation=0,sequence=0,requestSequence=0,opened=null;
 const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 function closePicker(){if(opened?.matches(':popover-open'))opened.hidePopover();opened=null;}
 function place(panel,button){
  const r=button.getBoundingClientRect(),width=Math.min(304,innerWidth-24),height=62;
  panel.style.width=width+'px';panel.style.left=Math.min(Math.max(12,r.left),innerWidth-width-12)+'px';
  panel.style.top=(r.top>height+16?r.top-height-8:Math.min(r.bottom+8,innerHeight-height-12))+'px';
 }
 function paint(item,rows){
  item.counts.replaceChildren();item.selected=null;
  for(const [key,emoji,label]of choices){
   const row=rows.find(r=>r.emoji===key),total=Number(row?.total);
   const selected=row?.mine===true;if(selected)item.selected=key;
   const option=item.panel.querySelector(`[data-reaction="${key}"]`);option.setAttribute('aria-pressed',String(selected));
   if(!Number.isSafeInteger(total)||total<1)continue;
   const b=node('button','reaction-count',`${emoji} ${total}`);b.type='button';b.setAttribute('aria-label',`${label}: ${total}`);b.setAttribute('aria-pressed',String(selected));
   b.addEventListener('click',()=>toggle(item,key));item.counts.append(b);
  }
 }
 async function load(ids){
  for(const [id,item]of mounted)if(!item.wrap.isConnected){item.panel.remove();mounted.delete(id);}
  if(!client||!ids.length)return false;
  const actor=generation,currentClient=client;
  for(let offset=0;offset<ids.length;offset+=200){
   const batch=ids.slice(offset,offset+200);
   const request=++requestSequence;for(const id of batch){const item=mounted.get(id);if(item)item.request=request;}
   try{
    const {data,error}=await currentClient.rpc('bg3ro_reaction_summary',{p_post_ids:batch});
    if(error||actor!==generation)return false;
    for(const id of batch){const item=mounted.get(id);if(item&&item.request===request)paint(item,Array.isArray(data)?data.filter(r=>r.post_id===id):[]);}
   }catch(_){return false; /* Unavailable counts stay absent, never fabricated. */ }
  }
  return true;
 }
 async function toggle(item,key){
  if(item.busy)return;
  if(!canReact||!client){closePicker();document.querySelector('.topbar [data-auth-open]')?.click();return;}
  const actor=generation,currentClient=client;item.busy=true;item.wrap.setAttribute('aria-busy','true');item.status.textContent='';
  item.panel.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   const {error}=await currentClient.rpc('bg3ro_toggle_reaction',{p_post_id:item.id,p_emoji:key});
   if(error)throw error;if(actor!==generation)return;
   closePicker();if(!await load([item.id]))item.status.textContent='Reacția a fost salvată. Numărătoarea nu este disponibilă momentan.';
  }catch(error){if(actor===generation)item.status.textContent=/rate|limit/i.test(error?.message||'')?'Prea multe reacții. Încearcă din nou peste un minut.':'Reacția nu a fost salvată. Încearcă din nou.';}
  finally{item.busy=false;item.wrap.removeAttribute('aria-busy');item.panel.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 function mount(parent,id){
  const wrap=node('div','post-reactions'),counts=node('div','reaction-counts'),trigger=node('button','reaction-trigger');
  trigger.type='button';trigger.title='Adaugă o reacție';trigger.setAttribute('aria-label','Adaugă o reacție');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-haspopup','dialog');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':1.6,'stroke-linecap':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
  const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx','12');circle.setAttribute('cy','12');circle.setAttribute('r','9');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01');svg.append(circle,path);trigger.append(svg);
  const panel=node('div','reaction-picker');panel.id='reaction-picker-'+(++sequence);panel.setAttribute('popover','auto');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Alege o reacție');trigger.setAttribute('aria-controls',panel.id);
  const status=node('span','reaction-status');status.setAttribute('role','status');
  const item={id,wrap,counts,panel,trigger,status,busy:false};
  for(const [key,emoji,label]of choices){const b=node('button','reaction-option',emoji);b.type='button';b.dataset.reaction=key;b.setAttribute('aria-label',label);b.title=label;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>toggle(item,key));panel.append(b);}
  panel.addEventListener('toggle',()=>{trigger.setAttribute('aria-expanded',String(panel.matches(':popover-open')));});
  panel.addEventListener('keydown',event=>{const buttons=[...panel.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();}});
  trigger.addEventListener('click',()=>{if(panel.matches(':popover-open')){closePicker();return;}closePicker();place(panel,trigger);panel.showPopover();opened=panel;panel.querySelector('button')?.focus({preventScroll:true});});
  wrap.append(counts,trigger,status);parent.append(wrap);document.body.append(panel);
  const previous=mounted.get(id);if(previous)previous.panel.remove();mounted.set(id,item);
 }
 window.addEventListener('bg3ro:auth',event=>{
  client=event.detail.client;canReact=!!event.detail.userId||event.detail.guest===true;generation++;closePicker();
  for(const item of mounted.values()){item.status.textContent='';paint(item,[]);}load([...mounted.keys()]);
 });
 addEventListener('scroll',()=>{if(!opened)return;const item=[...mounted.values()].find(item=>item.panel===opened);if(item?.trigger.isConnected)place(opened,item.trigger);else closePicker();},{capture:true,passive:true});addEventListener('resize',closePicker);
 window.BG3RO_REACTIONS={mount,load,close:closePicker};
})();
