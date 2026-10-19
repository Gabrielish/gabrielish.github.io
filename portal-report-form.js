(() => {
 'use strict';
 const select=document.querySelector('#report-version');
 if(!select)return;
 let versions=[];
 const key=value=>String(value).trim().toLowerCase();
 function render(state){
  const selected=select.value,first=document.createElement('option');first.value='';
  first.textContent=state==='error'&&!versions.length?'Versiuni indisponibile':versions.length?'Alege versiunea':'Nicio versiune publicată';
  select.replaceChildren(first);
  const choices=[...versions];
  if(selected&&selected!=='Nespecificată'&&!choices.some(v=>key(v)===key(selected)))choices.push(selected);
  for(const value of choices){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);}
  const unknown=document.createElement('option');unknown.value='Nespecificată';unknown.textContent='Nu știu versiunea';select.append(unknown);
  select.value=choices.find(v=>key(v)===key(selected))||(selected==='Nespecificată'?selected:'');
 }
 window.addEventListener('bg3ro:releases-updated',event=>{
  if(!Array.isArray(event.detail?.versions))return;
  const unique=new Map();
  for(const value of event.detail.versions)if(typeof value==='string'&&value.trim()&&value.trim().length<=80&&!unique.has(key(value)))unique.set(key(value),value.trim());
  versions=[...unique.values()];render('ready');
 });
 window.addEventListener('bg3ro:releases-unavailable',()=>render('error'));
})();
