(() => {
 'use strict';
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function icon(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[k,v]of Object.entries({viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor','stroke-width':1.7,'aria-hidden':'true'}))svg.setAttribute(k,v);const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d','M3 3v18h18M7 17V9m5 8V5m5 12v-6');svg.append(p);return svg;}
 const form=document.querySelector('#discussion-form'),bottom=form.querySelector('.discussion-compose-bottom');
 const add=node('button','discussion-add-poll','Adaugă un sondaj');add.type='button';add.prepend(icon());add.setAttribute('aria-expanded','false');add.setAttribute('aria-controls','discussion-poll-composer');bottom.prepend(add);
 form.querySelector('#discussion-character-count').classList.add('visually-hidden');
 const panel=node('fieldset','discussion-poll-composer');panel.id='discussion-poll-composer';panel.hidden=true;
 const heading=node('div','poll-heading'),legend=node('strong','','Sondaj'),close=node('button','poll-close','×');close.type='button';close.setAttribute('aria-label','Elimină sondajul');heading.append(icon(),legend,close);
 const question=node('input');question.id='poll-question';question.type='text';question.maxLength=200;question.minLength=3;question.placeholder='Întrebarea din sondaj…';question.setAttribute('aria-label','Întrebarea din sondaj');
 const options=node('div','poll-composer-options'),append=node('button','poll-add-option','+ Adaugă o opțiune');append.type='button';
 const multipleLabel=node('label','poll-multiple'),multiple=node('input');multiple.type='checkbox';multiple.id='poll-multiple';multipleLabel.append(multiple,document.createTextNode('Permite răspunsuri multiple'));
 panel.append(heading,question,options,append,multipleLabel);bottom.before(panel);
 function addOption(value=''){const row=node('div','poll-option-row'),input=node('input'),remove=node('button','poll-close','×');input.type='text';input.maxLength=120;input.value=value;remove.type='button';remove.setAttribute('aria-label','Elimină opțiunea');remove.onclick=()=>{row.remove();labels();};row.append(input,remove);options.append(row);labels();}
 function labels(){[...options.children].forEach((row,i)=>{const input=row.querySelector('input');input.placeholder=`Opțiunea ${i+1}`;input.setAttribute('aria-label',`Opțiunea ${i+1}`);row.querySelector('button').hidden=options.children.length<=2;});append.hidden=options.children.length>=8;}
 function active(value){panel.hidden=!value;panel.disabled=!value;add.hidden=value;add.setAttribute('aria-expanded',String(value));}
 function clear(){question.value='';multiple.checked=false;options.replaceChildren();addOption();addOption();active(false);}
 add.onclick=()=>{active(true);question.focus();};close.onclick=()=>{clear();add.focus();};append.onclick=()=>{if(options.children.length<8){addOption();options.lastElementChild.querySelector('input').focus();}};clear();
 function value(){if(panel.hidden)return null;const q=question.value.trim(),o=[...options.querySelectorAll('input')].map(input=>input.value.trim());if(q.length<3||o.length<2||o.some(v=>!v)||new Set(o.map(v=>v.toLocaleLowerCase('ro'))).size!==o.length)throw Error('Completează întrebarea și cel puțin două opțiuni diferite.');return{question:q,options:o,multiple:multiple.checked};}
 const mounted=new Map();let client=null,actor=null,generation=0,sequence=0,requestSequence=0;
 async function refresh(ids){if(!client||!ids.length)return;const ticket=generation,request=++requestSequence;for(const id of ids){const poll=mounted.get(id);if(poll)poll.request=request;}
  const result=await client.rpc('bg3ro_poll_summary',{p_post_ids:ids});if(result.error)throw result.error;if(ticket!==generation)return;
  for(const poll of mounted.values())if(ids.includes(poll.id)&&poll.request===request){const row=(Array.isArray(result.data)?result.data:[]).find(row=>row.post_id===poll.id);if(row)paint(poll,row);}
 }
 function paint(poll,summary){poll.choices=Array.isArray(summary.choices)?summary.choices:[];poll.inputs.forEach((input,i)=>{input.checked=poll.choices.includes(i);const total=Math.max(0,Number(summary.counts?.[i])||0),voters=Math.max(0,Number(summary.voters)||0);poll.totals[i].textContent=`${total} · ${voters?Math.round(total*100/voters):0}%`;poll.bars[i].style.width=`${voters?total*100/voters:0}%`;});poll.meta.textContent=`${summary.voters||0} ${Number(summary.voters)===1?'participant':'participanți'}${poll.multiple?' · Răspunsuri multiple':''}`;poll.submit.textContent=poll.choices.length?'Actualizează votul':'Votează';poll.remove.hidden=!poll.choices.length;}
 function mount(parent,data){const wrap=node('form','discussion-poll'),question=node('h3','',data.question),fields=node('fieldset'),meta=node('p','poll-meta'),status=node('p','poll-status');status.setAttribute('role','status');fields.setAttribute('aria-label',data.question);
  const poll={id:data.post_id,wrap,multiple:data.multiple,inputs:[],totals:[],bars:[],meta,status,choices:[],busy:false};
  const unique='poll-'+(++sequence);
  data.options.forEach((text,i)=>{const label=node('label','poll-vote-option'),bar=node('span','poll-option-bar'),input=node('input'),name=node('span','',text),total=node('span','poll-option-total','…');input.type=data.multiple?'checkbox':'radio';input.name=unique;input.value=String(i);input.setAttribute('aria-label',text);label.append(bar,input,name,total);fields.append(label);poll.inputs.push(input);poll.totals.push(total);poll.bars.push(bar);});
  const actions=node('div','poll-vote-actions'),submit=node('button','btn secondary small-btn','Votează'),remove=node('button','poll-remove','Retrage votul');submit.type='submit';remove.type='button';remove.hidden=true;poll.submit=submit;poll.remove=remove;actions.append(submit,remove);wrap.append(question,fields,meta,actions,status);
  wrap.onsubmit=e=>{e.preventDefault();const choices=poll.inputs.flatMap((input,i)=>input.checked?[i]:[]);if(!choices.length){status.textContent='Alege cel puțin o opțiune.';return;}vote(poll,choices);};remove.onclick=()=>vote(poll,[]);
  parent.insertBefore(wrap,parent.querySelector('.post-reactions,.post-actions'));mounted.set(data.post_id,poll);
 }
 async function vote(poll,choices){if(poll.busy)return;if(!client||!actor){document.querySelector('.topbar [data-auth-open]')?.click();return;}poll.busy=true;const ticket=generation;poll.wrap.querySelectorAll('button,input').forEach(n=>n.disabled=true);poll.status.textContent='Se salvează…';
  try{const result=await client.rpc('bg3ro_vote_poll',{p_post_id:poll.id,p_choices:choices});if(ticket!==generation)return;if(result.error)throw result.error;await refresh([poll.id]);poll.status.textContent='';}
  catch(_){if(ticket===generation){poll.status.textContent='Votul nu a fost salvat sau confirmat. Încearcă din nou.';poll.inputs.forEach((input,i)=>input.checked=poll.choices.includes(i));}}
  finally{poll.busy=false;poll.wrap.querySelectorAll('button,input').forEach(n=>n.disabled=false);}
 }
 async function load(ids){for(const[id,poll]of mounted)if(!poll.wrap.isConnected)mounted.delete(id);if(!client||!ids.length)return;const ticket=generation;
  try{const result=await client.from('bg3ro_discussion_polls').select('post_id,question,options,multiple').in('post_id',ids);if(result.error||ticket!==generation)return;
   for(const data of Array.isArray(result.data)?result.data:[]){const parent=document.getElementById('post-'+data.post_id)?.querySelector('.post-content');if(parent&&Array.isArray(data.options)&&!mounted.has(data.post_id))mount(parent,data);}await refresh(ids);
  }catch(_){/* Existing comments stay usable if polls are unavailable. */}
 }
 window.addEventListener('bg3ro:auth',event=>{client=event.detail.client;actor=event.detail.userId||(event.detail.guest?'guest':null);generation++;for(const poll of mounted.values()){poll.choices=[];poll.inputs.forEach(input=>input.checked=false);poll.remove.hidden=true;}refresh([...mounted.keys()]).catch(()=>{});});
 window.BG3RO_POLLS={value,clear,load};
})();
