import {Node} from '@tiptap/core';

let administrator=false;
addEventListener('bg3ro:auth',event=>{administrator=event.detail.moderator===true;});
export const canUseBadges=()=>administrator;
const icons={
 download:['Descărcare','M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5'],
 upload:['Încărcare','M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5'],
 tag:['Etichetă','M3 3h8l10 10-8 8L3 11V3Zm4 4h.01'],
 check:['Bifat','M20 6 9 17l-5-5'],
 star:['Stea','m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z'],
 clock:['În lucru','M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
 info:['Informație','M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
 heart:['Inimă','M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'],
 sparkles:['Noutate','m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6ZM20 2v4m-2-2h4'],
 bug:['Eroare','M8 7a4 4 0 0 1 8 0M7 9h10v7a5 5 0 0 1-10 0V9ZM12 9v12M3 11h4m10 0h4M3 16h4m10 0h4M5 4l3 3m11-3-3 3'],
 folder:['Folder','M3 5h6l2 3h10v12H3V5Z'],
 shield:['Scut','m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z']
};
const svgNS='http://www.w3.org/2000/svg';
const create=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
function vector(name){const svg=document.createElementNS(svgNS,'svg');for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);const path=document.createElementNS(svgNS,'path');path.setAttribute('d',icons[name][1]);svg.append(path);return svg;}

// Rebuild SVG geometry in a fresh document: scripts, CSS, links, images,
// event handlers, filters and external resources never enter the rendered DOM.
export function safeBadgeSVG(value){
 if(typeof value!=='string'||value.length>16000||/<!DOCTYPE|<!ENTITY/i.test(value))return '';
 const parsed=new DOMParser().parseFromString(value,'image/svg+xml'),source=parsed.documentElement;
 if(source.localName!=='svg'||parsed.querySelector('parsererror'))return '';
 const output=document.createElementNS(svgNS,'svg'),box=(source.getAttribute('viewBox')||`0 0 ${parseFloat(source.getAttribute('width'))||24} ${parseFloat(source.getAttribute('height'))||24}`).trim().split(/[\s,]+/).map(Number);
 output.setAttribute('xmlns',svgNS);
 if(box.length!==4||box.some(n=>!Number.isFinite(n)||Math.abs(n)>1000000)||box[2]<=0||box[3]<=0)return '';
 output.setAttribute('viewBox',box.join(' '));output.setAttribute('width','16');output.setAttribute('height','16');output.setAttribute('fill','currentColor');output.setAttribute('aria-hidden','true');output.setAttribute('focusable','false');
 const geometry={g:[],path:['d'],rect:['x','y','width','height','rx','ry'],circle:['cx','cy','r'],ellipse:['cx','cy','rx','ry'],line:['x1','x2','y1','y2'],polyline:['points'],polygon:['points']};let budget=80;
 function copy(parent,element){if(--budget<0||!Object.hasOwn(geometry,element.localName))return;const target=document.createElementNS(svgNS,element.localName);
  for(const key of geometry[element.localName]){const value=element.getAttribute(key);if(value===null)continue;if(key==='d'&&value.length<=6000&&/^[MmLlHhVvCcSsQqTtAaZz\d.,+\-\sEe]+$/.test(value))target.setAttribute(key,value);else if(key==='points'&&/^[\d.,+\-\sEe]+$/.test(value))target.setAttribute(key,value);else if(!['d','points'].includes(key)&&Number.isFinite(Number(value))&&Math.abs(Number(value))<=1000000)target.setAttribute(key,value);}
  for(const key of ['fill','stroke']){const explicit=element.getAttribute(key),style=element.getAttribute('style')||'';if(explicit!==null||new RegExp('(?:^|;)\\s*'+key+'\\s*:','i').test(style))target.setAttribute(key,explicit==='none'||new RegExp('(?:^|;)\\s*'+key+'\\s*:\\s*none\\s*(?:;|$)','i').test(style)?'none':'currentColor');}
  const transform=element.getAttribute('transform');if(transform&&transform.length<=300&&/^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([\d.,+\-\sEe]+\)\s*)+$/.test(transform))target.setAttribute('transform',transform);
  const width=element.getAttribute('stroke-width');if(width!==null&&Number(width)>0&&Number(width)<=20)target.setAttribute('stroke-width',width);
  for(const key of ['stroke-linecap','stroke-linejoin','fill-rule']){const val=element.getAttribute(key);if(['round','butt','square','miter','bevel','evenodd','nonzero'].includes(val))target.setAttribute(key,val);}
  for(const child of element.children)copy(target,child);parent.append(target);
 }
 const rootGroup=output;
 for(const key of ['fill','stroke','stroke-width'])if(source.hasAttribute(key))rootGroup.setAttribute(key,key==='stroke-width'?String(Math.min(20,Math.max(.1,parseFloat(source.getAttribute(key))||1.7))):source.getAttribute(key)==='none'?'none':'currentColor');
 for(const child of source.children)copy(rootGroup,child);
 const result=output.outerHTML;return output.querySelector('path[d],rect,circle,ellipse,line,polyline,polygon')&&result.length<=12000?result:'';
}
export function cleanBadge(value={}){return{label:String(value.label||'Etichetă').replace(/\s+/g,' ').trim().slice(0,80)||'Etichetă',color:/^#[\da-f]{6}$/i.test(value.color||'')?value.color.toLowerCase():'#22c55e',icon:String(value.icon??'download').slice(0,32),svg:safeBadgeSVG(value.svg)};}
export function badgeElement(value){const attrs=cleanBadge(value),element=create('span');element.className='content-badge';element.setAttribute('data-content-badge',JSON.stringify(attrs));element.style.setProperty('--badge-color',attrs.color);
 if(attrs.svg){const holder=create('span');holder.className='content-badge-icon';holder.append(new DOMParser().parseFromString(attrs.svg,'image/svg+xml').documentElement);element.append(holder);}
 else if(icons[attrs.icon])element.append(vector(attrs.icon));else if(attrs.icon){const icon=create('span',attrs.icon);icon.className='content-badge-icon';icon.setAttribute('aria-hidden','true');element.append(icon);}
 element.append(create('span',attrs.label));return element;
}
export const Badge=Node.create({name:'badge',inline:true,group:'inline',atom:true,selectable:true,
 addAttributes(){return{label:{default:'Etichetă'},color:{default:'#22c55e'},icon:{default:'download'},svg:{default:''}};},
 parseHTML(){return[{tag:'span[data-content-badge]',getAttrs:element=>{if(!administrator)return false;try{return cleanBadge(JSON.parse(element.getAttribute('data-content-badge')));}catch{return false;}}}];},
 renderHTML({node}){return badgeElement(node.attrs);},renderText({node}){return cleanBadge(node.attrs).label;}
});

export function mountBadgeTools(editor,toolbar,form){
 for(const old of form.querySelectorAll('.discussion-badge-panel'))old.remove();
 const group=create('div');group.className='discussion-tool-group';group.hidden=!administrator;group.setAttribute('aria-label','Etichete administrator');
 const trigger=create('button');trigger.type='button';trigger.className='discussion-tool discussion-badge-trigger';trigger.setAttribute('aria-label','Etichetă');trigger.title='Adaugă sau modifică o etichetă';trigger.append(vector('tag'));group.append(trigger);toolbar.append(group);
 const panel=create('div');panel.className='discussion-badge-panel';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','Configurarea etichetei');toolbar.after(panel);
 const fields=create('div');fields.className='badge-fields';const label=create('input');label.type='text';label.maxLength=80;label.placeholder='Versiunea v0.7.96';label.setAttribute('aria-label','Textul etichetei');
 const color=create('input');color.type='color';color.setAttribute('aria-label','Culoarea etichetei');const hex=create('input');hex.type='text';hex.maxLength=7;hex.setAttribute('aria-label','Codul culorii etichetei');hex.placeholder='#22c55e';fields.append(label,color,hex);panel.append(fields);
 const palette=create('div');palette.className='badge-palette';const paletteColors=[['#ef4444','Roșu'],['#f97316','Portocaliu'],['#eab308','Galben'],['#22c55e','Verde'],['#3b82f6','Albastru'],['#a855f7','Mov'],['#ec4899','Roz'],['#6b7280','Gri'],['#d7bc8a','Auriu']];
 const choices=create('div');choices.className='badge-icons';choices.setAttribute('aria-label','Iconițe pentru etichetă');let selected='download',custom='',bookmark=null,editing=false;
 const preview=create('div');preview.className='badge-preview';const status=create('p');status.className='discussion-badge-status';status.setAttribute('role','status');
 const current=()=>cleanBadge({label:label.value,color:hex.value,icon:selected,svg:custom});
 function refresh(){preview.replaceChildren(badgeElement(current()));for(const b of choices.children)b.setAttribute('aria-pressed',String(b.dataset.icon===selected&&!custom));}
 for(const [value,title]of paletteColors){const b=create('button');b.type='button';b.className='badge-swatch';b.style.backgroundColor=value;b.setAttribute('aria-label','Etichetă '+title);b.onclick=()=>{hex.value=color.value=value;refresh();};palette.append(b);}panel.append(palette);
 for(const [name,[title]]of Object.entries(icons)){const b=create('button');b.type='button';b.className='discussion-tool';b.dataset.icon=name;b.title=title;b.setAttribute('aria-label','Iconiță '+title);b.append(vector(name));b.onclick=()=>{selected=name;custom='';emoji.value='';refresh();};choices.append(b);}panel.append(choices);
 const extra=create('div');extra.className='badge-extra';const emoji=create('input');emoji.type='text';emoji.maxLength=32;emoji.placeholder='Sau un emoji: 🎲';emoji.setAttribute('aria-label','Emoji sau simbol pentru etichetă');
 const file=create('input');file.type='file';file.accept='.svg,image/svg+xml';file.hidden=true;file.setAttribute('aria-label','Alege iconiță SVG');const upload=create('button','Încarcă SVG');upload.type='button';upload.className='btn secondary small-btn';upload.onclick=()=>file.click();extra.append(emoji,upload,file);panel.append(extra,preview);
 const actions=create('div');actions.className='form-end';const cancel=create('button','Anulează'),insert=create('button','Inserează eticheta');cancel.type=insert.type='button';cancel.className='btn secondary small-btn';insert.className='btn small-btn';actions.append(cancel,insert);panel.append(actions,status);
 function close(){panel.hidden=true;trigger.setAttribute('aria-expanded','false');status.textContent='';}
 trigger.setAttribute('aria-expanded','false');trigger.onmousedown=event=>event.preventDefault();trigger.onclick=()=>{if(!administrator)return;if(!panel.hidden){close();return;}bookmark=editor.state.selection.getBookmark();editing=editor.isActive('badge');const attrs=cleanBadge(editing?editor.getAttributes('badge'):{label:editor.state.doc.textBetween(editor.state.selection.from,editor.state.selection.to,' ').trim()||'Etichetă'});selected=attrs.icon;custom=attrs.svg;label.value=attrs.label;color.value=hex.value=attrs.color;emoji.value=icons[selected]?'':selected;insert.textContent=editing?'Salvează eticheta':'Inserează eticheta';panel.hidden=false;trigger.setAttribute('aria-expanded','true');refresh();label.focus();label.select();};
 label.oninput=refresh;color.oninput=()=>{hex.value=color.value;refresh();};hex.oninput=()=>{if(/^#[\da-f]{6}$/i.test(hex.value)){color.value=hex.value;refresh();}};emoji.oninput=()=>{selected=emoji.value;custom='';refresh();};
 file.onchange=async()=>{const selectedFile=file.files[0];file.value='';if(!selectedFile)return;if(selectedFile.size>16000){status.textContent='Alege un SVG de maximum 16 KB.';return;}const svg=safeBadgeSVG(await selectedFile.text());if(!administrator)return;if(!svg){status.textContent='SVG-ul nu conține o iconiță vectorială validă.';return;}custom=svg;selected='';emoji.value='';status.textContent='';refresh();};
 insert.onclick=()=>{if(!administrator)return;if(!label.value.trim()||!/^#[\da-f]{6}$/i.test(hex.value)){status.textContent='Completează textul și o culoare de forma #22c55e.';return;}try{const selection=bookmark.resolve(editor.state.doc);editor.view.dispatch(editor.state.tr.setSelection(selection));editor.view.focus();if(editing&&editor.isActive('badge'))editor.commands.updateAttributes('badge',current());else editor.commands.insertContent([{type:'badge',attrs:current()},{type:'text',text:' '}]);close();}catch{status.textContent='Selectează din nou locul unde vrei eticheta.';}};
 cancel.onclick=()=>{close();editor.view.focus();};
 const auth=()=>{group.hidden=!administrator;if(!administrator)close();};addEventListener('bg3ro:auth',auth);
 return()=>{removeEventListener('bg3ro:auth',auth);panel.remove();group.remove();};
}
