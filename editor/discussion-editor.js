/*! BG3.RO visual editor; Tiptap/ProseMirror MIT notices: ../editor/THIRD_PARTY_LICENSES.txt */
import {Editor,Node} from '@tiptap/core';
import {EditorState} from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import {TextStyle,FontFamily,FontSize,Color} from '@tiptap/extension-text-style';
import {Badge,cleanBadge,badgeElement,canUseBadges,mountBadgeTools} from './badges.js';
import {mountUpdateBadgeField} from './badge-field.js';
window.BG3RO_BADGES={element:badgeElement,mountField:mountUpdateBadgeField};
import {YouTube,youtubeID,youtubeElement} from './youtube.js';

const prefix='BG3RO-RICH-1:';
function imageURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
const InlineImage=Node.create({name:'image',group:'block',atom:true,draggable:true,addAttributes(){return{src:{default:null},alt:{default:'Imagine atașată'}};},parseHTML(){return[{tag:'img[src]',getAttrs:el=>{const src=imageURL(el.getAttribute('src'));return src?{src,alt:(el.getAttribute('alt')||'Imagine atașată').slice(0,160)}:false;}}];},renderHTML({HTMLAttributes}){return['img',{src:imageURL(HTMLAttributes.src)||'',alt:String(HTMLAttributes.alt||'Imagine atașată').slice(0,160),class:'discussion-inline-image',loading:'lazy',referrerpolicy:'no-referrer'}];}});
const extensions=[StarterKit.configure({heading:{levels:[2,3]},link:{openOnClick:false,autolink:false,defaultProtocol:'https',protocols:['https','http']}}),TextAlign.configure({types:['heading','paragraph']}),TextStyle,FontFamily,FontSize,Color,InlineImage,Badge,YouTube];
const fonts=['Arial','Georgia','Verdana','monospace'],sizes=['12px','14px','16px','18px','20px','24px'];
let colorMenuSequence=0;
function textStyle(attrs={}){const clean={};if(fonts.includes(attrs.fontFamily))clean.fontFamily=attrs.fontFamily;if(sizes.includes(attrs.fontSize))clean.fontSize=attrs.fontSize;if(/^#[\da-f]{6}$/i.test(attrs.color||''))clean.color=attrs.color;return clean;}
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function dropdownChevron(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[key,value]of Object.entries({viewBox:'0 0 16 16',width:12,height:12,fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',class:'editor-dropdown-chevron'}))svg.setAttribute(key,value);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','m4 6 4 4 4-4');svg.append(path);return svg;}
function safeURL(value){if(['#despre','#actualizari','#descarcari','#discutii','#erori','#contact','#intrebari-frecvente'].includes(value))return value;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
function cleanDoc(value,allowBadges=true){
 let budget=2000;
 function clean(n,depth=0){
  if(!n||typeof n!=='object'||depth>16||--budget<0)return null;
  if(n.type==='badge'){const attrs=cleanBadge(n.attrs);return allowBadges?{type:'badge',attrs}:{type:'text',text:attrs.label};}
  if(n.type==='youtube'){const videoId=youtubeID(n.attrs?.videoId);return videoId?{type:'youtube',attrs:{videoId}}:null;}
  if(n.type==='image'){const src=imageURL(n.attrs?.src);return src?{type:'image',attrs:{src,alt:String(n.attrs?.alt||'Imagine atașată').slice(0,160)}}:null;}
  if(n.type==='text'){
   const result={type:'text',text:String(n.text||'')};
   result.marks=(Array.isArray(n.marks)?n.marks:[]).flatMap(m=>{
    if(['bold','italic','underline','strike','code'].includes(m.type))return [{type:m.type}];
    if(m.type==='textStyle'){const attrs=textStyle(m.attrs);return Object.keys(attrs).length?[{type:'textStyle',attrs}]:[];}
    const href=m.type==='link'&&safeURL(m.attrs?.href);return href?[{type:'link',attrs:{href}}]:[];
   });return result.text?result:null;
  }
  if(!['doc','paragraph','heading','bulletList','orderedList','listItem','blockquote','codeBlock','hardBreak','horizontalRule'].includes(n.type))return null;
  const result={type:n.type};
  if(n.type==='heading')result.attrs={level:n.attrs?.level===3?3:2};
  if(['paragraph','heading'].includes(n.type)&&['left','center','right','justify'].includes(n.attrs?.textAlign))result.attrs={...result.attrs,textAlign:n.attrs.textAlign};
  if(Array.isArray(n.content))result.content=n.content.map(child=>clean(child,depth+1)).filter(Boolean);
  return result;
 }
 const doc=clean(value);return doc?.type==='doc'?doc:{type:'doc',content:[]};
}
function documentFor(body){
 if(String(body).startsWith(prefix)){try{return cleanDoc(JSON.parse(body.slice(prefix.length)));}catch(_){}}
 return {type:'doc',content:String(body||'').split(/\r?\n/).map(text=>({type:'paragraph',content:text?[{type:'text',text}]:[]}))};
}
function render(body){
 const output=node('div');output.className='post-body discussion-rich';
 const tags={paragraph:'p',heading:'h2',bulletList:'ul',orderedList:'ol',listItem:'li',blockquote:'blockquote',codeBlock:'pre',hardBreak:'br',horizontalRule:'hr'};
 function append(parent,n){
  if(n.type==='doc'){(n.content||[]).forEach(child=>append(parent,child));return;}
  if(n.type==='badge'){parent.append(badgeElement(n.attrs));return;}
  if(n.type==='youtube'){parent.append(youtubeElement(n.attrs.videoId));return;}
  if(n.type==='image'){const src=imageURL(n.attrs?.src);if(!src)return;const image=node('img');image.src=src;image.alt=n.attrs.alt;image.className='discussion-inline-image';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.tabIndex=0;image.setAttribute('role','button');image.setAttribute('aria-label','Deschide imaginea: '+n.attrs.alt);const open=()=>{const images=[...output.querySelectorAll('.discussion-inline-image')];window.BG3RO_IMAGE_VIEWER?.open(images.map(item=>({src:item.src,alt:item.alt})),images.indexOf(image),'Imagini atașate');};image.onclick=open;image.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};parent.append(image);return;}
  if(n.type==='text'){
   let text=document.createTextNode(n.text);
   for(const mark of n.marks||[]){const tag={bold:'strong',italic:'em',underline:'u',strike:'s',code:'code',link:'a',textStyle:'span'}[mark.type];if(!tag)continue;const wrap=node(tag);
    if(tag==='span')Object.assign(wrap.style,textStyle(mark.attrs));
    if(tag==='a'){const href=safeURL(mark.attrs?.href);if(!href)continue;wrap.href=href;wrap.target='_blank';wrap.rel='noopener noreferrer nofollow ugc';}
    wrap.append(text);text=wrap;
   }parent.append(text);return;
  }
  const tag=n.type==='heading'&&n.attrs?.level===3?'h3':tags[n.type];if(!tag)return;
  const el=node(tag);if(n.attrs?.textAlign)el.style.textAlign=n.attrs.textAlign;
  (n.content||[]).forEach(child=>append(el,child));parent.append(el);
 }
 append(output,documentFor(body));return output;
}
function mount(form,isReply=false,isReport=false,idPrefix='',settings={}){
let editor=null,cleanupResize=()=>{},cleanupListeners=()=>{},uploadFiles=null,uploading=false,destroyed=false,imageEpoch=0,closeImage=()=>{},closeVideo=()=>{};
const q=selector=>form.querySelector(idPrefix?selector.replaceAll('#discussion-','#'+idPrefix+'discussion-'):isReport?selector.replaceAll('#discussion-','#report-'):isReply?selector.replaceAll('#discussion-','#reply-discussion-'):selector);
const minimum=settings.minimum??(isReport?20:10),maximum=settings.maximum??(isReport?6000:4000);
const textarea=q('#discussion-body');
const host=q('#discussion-editor'),toolbar=q('#discussion-toolbar');
function plainDoc(doc){return doc.content.every(n=>n.type==='paragraph'&&!n.attrs?.textAlign&&(n.content||[]).every(t=>t.type==='text'&&!(t.marks||[]).length));}
function serialize(doc){return plainDoc(doc)?doc.content.map(p=>(p.content||[]).map(t=>t.text).join('')).join('\n'):prefix+JSON.stringify(doc);}
const api={render,documentFor,hasMention:body=>{
 const first=documentFor(body).content?.[0];return first?.type==='paragraph'&&first.content?.[0]?.text?.startsWith('@');
},get editor(){return editor;},clear(){imageEpoch++;editor?.commands.clearContent();textarea.value='';},reset(){
 imageEpoch++;
 closeImage();
 closeVideo();
 form.querySelectorAll('.discussion-badge-panel').forEach(panel=>panel.hidden=true);form.querySelectorAll('.discussion-badge-trigger').forEach(button=>button.setAttribute('aria-expanded','false'));
 for(const menu of form.querySelectorAll('.discussion-editor-menu:popover-open'))menu.hidePopover();
 if(editor){editor.commands.clearContent();editor.view.updateState(EditorState.create({schema:editor.schema,plugins:editor.state.plugins,doc:editor.state.doc}));editor.emit('selectionUpdate',{editor,transaction:editor.state.tr});}
 textarea.value='';q('#discussion-character-count').textContent='';q('#discussion-editor-error').textContent='';
 q('#discussion-link-panel').hidden=true;const url=q('#discussion-link-url');url.disabled=true;url.value='';url.setCustomValidity('');
 const status=form.querySelector('.form-status');status.textContent='';status.classList.remove('error');
},focus(){editor?.view.focus();},destroy(){destroyed=true;imageEpoch++;cleanupResize();cleanupListeners();editor?.destroy();},
 value(name=''){
  if(!editor)return textarea.value;
  if(uploading)throw Error('Așteaptă încărcarea imaginilor înainte de a trimite.');
  const doc=cleanDoc(editor.getJSON(),canUseBadges());
  if(name&&doc.content?.[0]?.content?.[0]?.text!=='@'+name)doc.content.unshift({type:'paragraph',content:[{type:'text',text:'@'+name}]});
  const body=serialize(doc);
  let hasImage=false;editor.state.doc.descendants(n=>{if(['image','youtube'].includes(n.type.name))hasImage=true;});
  if(editor.getText().trim().length<minimum&&!(hasImage&&!isReport))throw Error(`Scrie ${isReport?'o descriere':'un mesaj'} de cel puțin ${minimum} caractere.`);
  if(body.length>maximum)throw Error('Textul este prea lung. Scurtează textul sau elimină o parte din formatare.');
  return body;
 },quote(body,name){
  editor?.commands.insertContent([{type:'paragraph',content:[{type:'text',text:'@'+name}]},{type:'blockquote',content:documentFor(body).content},{type:'paragraph'}]);editor?.commands.focus('end');
 }};
if(textarea&&host){
 form.querySelectorAll('.discussion-image-panel,.discussion-video-panel').forEach(panel=>panel.remove());
 editor=new Editor({element:host,extensions,content:documentFor(textarea.value),editorProps:{attributes:{role:'textbox','aria-label':settings.label||(isReport?'Descrie eroarea de traducere':isReply?'Răspuns':'Mesaj'),'aria-multiline':'true','data-placeholder':settings.placeholder||(isReport?'Descrie eroarea de traducere…':'Scrie un comentariu…'),class:'discussion-prosemirror'},handlePaste(view,event){
  if(event.clipboardData?.files.length){event.preventDefault();uploadFiles?.([...event.clipboardData.files]);return true;}return false;
 },handleDrop(view,event,moved){if(!moved&&event.dataTransfer?.files.length){event.preventDefault();uploadFiles?.([...event.dataTransfer.files]);return true;}return false;}},onUpdate(){
  const body=serialize(cleanDoc(editor.getJSON(),canUseBadges()));textarea.value=body;
  q('#discussion-character-count').textContent=`${editor.getText().length} caractere`;
  q('#discussion-editor-error').textContent=body.length>maximum?'Textul depășește limita. Scurtează textul sau formatarea.':'';
  const status=form.querySelector('.form-status.error');if(status){status.textContent='';status.classList.remove('error');}
  refresh();
 },onSelectionUpdate(){refresh();}});
 textarea.hidden=true;textarea.required=false;
 // Retain the original plain textarea as a functional no-bundle fallback.
 const syncTextarea=()=>{if(textarea.value!==serialize(cleanDoc(editor.getJSON(),canUseBadges())))editor.commands.setContent(documentFor(textarea.value));},resetEditor=()=>editor.commands.clearContent();
 textarea.addEventListener('input',syncTextarea);form.addEventListener('reset',resetEditor);
 cleanupListeners=()=>{textarea.removeEventListener('input',syncTextarea);form.removeEventListener('reset',resetEditor);};
 const icons={bold:'M6 4h7a4 4 0 0 1 0 8H6m0-8v16h8a4 4 0 0 0 0-8H6',italic:'M16 4H9m6 0L9 20m-5 0h7',underline:'M6 3v7a6 6 0 0 0 12 0V3M4 21h16',strike:'M17 5c-1-2-3-2-5-2-6 0-7 7-2 8m-6 1h16m-5 2c5 3 1 8-4 7-2 0-4-1-5-3',bullet:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',ordered:'M9 6h12M9 12h12M9 18h12M3 4v5M2 9h3M2 14c3-3 4 0 1 2l-1 2h3',quote:'M10 11H4V7h6v6c0 3-2 5-5 5m15-7h-6V7h6v6c0 3-2 5-5 5',code:'m8 5-7 7 7 7m8-14 7 7-7 7',left:'M3 5h18M3 10h12M3 15h18M3 20h12',center:'M3 5h18M6 10h12M3 15h18M6 20h12',right:'M3 5h18M9 10h12M3 15h18M9 20h12',link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',undo:'M3 4v6h6M3 10a9 9 0 1 1 1 9',redo:'M21 4v6h-6m6 0a9 9 0 1 0-1 9'};
 icons.justify='M3 5h18M3 10h18M3 15h18M3 20h18';
 icons.separator='M4 12h16';
 icons.image='M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 13 5-5 4 4 4-6 5 7M8 7h.01';
 icons.imageURL='M12 21H4V3h16v9M3 15l5-5 4 4 4-6 4 5M8 7h.01M15 18l2-2a3 3 0 0 1 4 4l-2 2m-5-1-1 1a3 3 0 0 1-4-4l2-2m3 4 3-3';
 icons.video='M3 5h13v14H3V5Zm13 5 5-4v12l-5-4';
 const controls=[],selects=[];
 let group=toolbar;
 function section(label){group=node('div');group.className='discussion-tool-group';group.setAttribute('role','group');group.setAttribute('aria-label',label);toolbar.append(group);}
 function select(label,options,attribute,command){
  let selection=null;
  const trigger=node('button'),caption=node('span'),chevron=dropdownChevron(),menu=node('div');
  trigger.type='button';trigger.className='discussion-tool-select';trigger.setAttribute('aria-label',label);trigger.title=label;chevron.setAttribute('aria-hidden','true');trigger.append(caption,chevron);
  menu.className='discussion-editor-menu discussion-font-menu';menu.id='editor-font-'+(++colorMenuSequence);menu.setAttribute('popover','auto');menu.setAttribute('role','menu');menu.setAttribute('aria-label',label);
  for(const [value,text]of options){const option=node('button',text);option.type='button';option.tabIndex=-1;option.dataset.value=value;option.setAttribute('role','menuitemradio');option.setAttribute('aria-checked','false');option.addEventListener('mousedown',event=>event.preventDefault());option.addEventListener('click',()=>{close();if(selection)editor.view.dispatch(editor.state.tr.setSelection(selection.resolve(editor.state.doc)));editor.view.focus();command(value);});menu.append(option);}
  function close(){if(menu.matches(':popover-open'))menu.hidePopover();trigger.setAttribute('aria-expanded','false');}
  function open(){selection=editor.state.selection.getBookmark();menu.showPopover();trigger.setAttribute('aria-expanded','true');const r=trigger.getBoundingClientRect(),m=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-m.width-8))+'px';menu.style.top=Math.max(8,Math.min(r.bottom+5+m.height<=innerHeight-8?r.bottom+5:r.top-m.height-5,innerHeight-m.height-8))+'px';(menu.querySelector('[aria-checked=true]')||menu.querySelector('button'))?.focus({preventScroll:true});}
  trigger.setAttribute('popovertarget',menu.id);trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-controls',menu.id);trigger.setAttribute('aria-expanded','false');
  trigger.addEventListener('mousedown',event=>event.preventDefault());trigger.addEventListener('click',event=>{event.preventDefault();menu.matches(':popover-open')?close():open();});
  trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();}});
  menu.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
  menu.addEventListener('keydown',event=>{const items=[...menu.querySelectorAll('button')],i=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}else if(event.key==='Escape'||event.key==='Tab'){if(event.key==='Escape')event.preventDefault();close();trigger.focus({preventScroll:true});}});
  group.append(trigger,menu);selects.push({trigger,caption,menu,attribute,close});
 }
 function button(label,icon,command,active){const b=node('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.className='discussion-tool';
  if(icons[icon]){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [k,v]of Object.entries({viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[icon]);svg.append(path);b.append(svg);}else b.textContent=icon;
  // Focus synchronously in this vanilla DOM editor: delayed Tiptap focus can
  // otherwise steal the next keystroke from another field in the update form.
  b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',event=>{editor.view.focus();command(event);});group.append(b);controls.push([b,active]);return b;
 }
 section('Font și mărime');
 select('Font',[['','Font'],...fonts.map(v=>[v,v])],'fontFamily',v=>v?editor.chain().focus().setFontFamily(v).run():editor.chain().focus().unsetFontFamily().run());
 select('Mărimea textului',[['','Font size'],...sizes.map(v=>[v,v])],'fontSize',v=>v?editor.chain().focus().setFontSize(v).run():editor.chain().focus().unsetFontSize().run());
 section('Stilul textului');
 button('Aldin','bold',()=>editor.chain().focus().toggleBold().run(),()=>editor.isActive('bold'));
 button('Cursiv','italic',()=>editor.chain().focus().toggleItalic().run(),()=>editor.isActive('italic'));
 button('Subliniat','underline',()=>editor.chain().focus().toggleUnderline().run(),()=>editor.isActive('underline'));
 button('Tăiat','strike',()=>editor.chain().focus().toggleStrike().run(),()=>editor.isActive('strike'));
 const palette=[['','Implicit'],['#ef4444','Roșu'],['#f97316','Portocaliu'],['#eab308','Galben'],['#22c55e','Verde'],['#3b82f6','Albastru'],['#a855f7','Mov'],['#ec4899','Roz'],['#6b7280','Gri']];
 const colorMenu=node('div');colorMenu.className='discussion-editor-menu discussion-color-menu';colorMenu.id='editor-colors-'+(++colorMenuSequence);colorMenu.setAttribute('popover','auto');colorMenu.setAttribute('role','menu');colorMenu.setAttribute('aria-label','Culori pentru text');
 const closeColors=()=>{if(colorMenu.matches(':popover-open'))colorMenu.hidePopover();colorButton.setAttribute('aria-expanded','false');};
 const colorButton=button('Culoarea textului','A',event=>{
  event.preventDefault();
  if(colorMenu.matches(':popover-open')){closeColors();return;}
  colorMenu.showPopover();colorButton.setAttribute('aria-expanded','true');const r=colorButton.getBoundingClientRect(),m=colorMenu.getBoundingClientRect();
  colorMenu.style.left=Math.max(8,Math.min(r.left,innerWidth-m.width-8))+'px';
  colorMenu.style.top=Math.max(8,Math.min(r.bottom+5+m.height<=innerHeight-8?r.bottom+5:r.top-m.height-5,innerHeight-m.height-8))+'px';
  (colorMenu.querySelector('[aria-checked=true]')||colorMenu.querySelector('button'))?.focus({preventScroll:true});
 });
 // Declare the invoker so native light-dismiss does not close the menu on
 // pointerdown and then make our click handler reopen it immediately.
 colorButton.setAttribute('popovertarget',colorMenu.id);
 colorButton.classList.add('discussion-color');colorButton.replaceChildren(node('span','A'),dropdownChevron());colorButton.setAttribute('aria-haspopup','menu');colorButton.setAttribute('aria-controls',colorMenu.id);colorButton.setAttribute('aria-expanded','false');
 for(const [value,label]of palette){const option=node('button');option.type='button';option.setAttribute('role','menuitemradio');option.setAttribute('aria-checked','false');option.dataset.color=value;const swatch=node('span');swatch.className='editor-color-swatch';swatch.style.backgroundColor=value||'var(--panel)';swatch.setAttribute('aria-hidden','true');option.append(swatch,node('span',label));option.addEventListener('mousedown',event=>event.preventDefault());option.addEventListener('click',()=>{closeColors();editor.view.focus();const chain=editor.chain().focus();value?chain.setColor(value).run():chain.unsetColor().run();});colorMenu.append(option);}
 group.append(colorMenu);
 colorMenu.addEventListener('toggle',()=>colorButton.setAttribute('aria-expanded',String(colorMenu.matches(':popover-open'))));
 colorMenu.addEventListener('keydown',event=>{const options=[...colorMenu.querySelectorAll('button')],i=options.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();options[event.key==='Home'?0:event.key==='End'?options.length-1:(i+(event.key==='ArrowDown'?1:-1)+options.length)%options.length].focus();}else if(event.key==='Escape'||event.key==='Tab'){if(event.key==='Escape')event.preventDefault();closeColors();colorButton.focus({preventScroll:true});}});
 section('Titluri');
 for(const level of [2,3])button('Titlu H'+level,'H'+level,()=>editor.chain().focus().toggleHeading({level}).run(),()=>editor.isActive('heading',{level}));
 section('Aliniere');
 for(const align of ['left','center','right','justify'])button({left:'Aliniere la stânga',center:'Aliniere centrată',right:'Aliniere la dreapta',justify:'Aliniere justificată'}[align],align,()=>editor.chain().focus().setTextAlign(align).run(),()=>editor.isActive({textAlign:align}));
 section('Liste');
 button('Listă cu puncte','bullet',()=>editor.chain().focus().toggleBulletList().run(),()=>editor.isActive('bulletList'));
 button('Listă numerotată','ordered',()=>editor.chain().focus().toggleOrderedList().run(),()=>editor.isActive('orderedList'));
 section('Citat și cod');
 button('Citat','quote',()=>editor.chain().focus().toggleBlockquote().run(),()=>editor.isActive('blockquote'));
 button('Cod','code',()=>editor.chain().focus().toggleCodeBlock().run(),()=>editor.isActive('codeBlock'));
 button('Linie orizontală','separator',()=>editor.chain().focus().setHorizontalRule().run());
 section('Linkuri');
 const panel=q('#discussion-link-panel'),url=q('#discussion-link-url');url.disabled=true;
 const closeLink=()=>{panel.hidden=true;url.disabled=true;url.setCustomValidity('');};
 const link=button('Adaugă sau modifică linkul','link',()=>{url.disabled=false;url.value=editor.getAttributes('link').href||'';panel.hidden=false;url.focus();},()=>editor.isActive('link'));
 q('#discussion-link-save').onclick=()=>{const href=safeURL(url.value.trim());if(!href){url.setCustomValidity('Introdu o adresă http:// sau https:// validă.');url.reportValidity();return;}url.setCustomValidity('');editor.view.focus();editor.chain().focus().extendMarkRange('link').setLink({href}).run();closeLink();};
 url.oninput=()=>url.setCustomValidity('');
 q('#discussion-link-remove').onclick=()=>{editor.view.focus();editor.chain().focus().extendMarkRange('link').unsetLink().run();closeLink();};
 q('#discussion-link-cancel').onclick=()=>{closeLink();link.focus();};
 // Inline controls: files for public posts, HTTPS image links everywhere.
 for(const old of form.querySelectorAll('.discussion-image-panel'))old.remove();
 const imagePanel=node('div');imagePanel.className='discussion-image-panel';imagePanel.hidden=true;
 const imageFile=node('input');imageFile.type='file';imageFile.accept='image/jpeg,image/png,image/webp';imageFile.multiple=true;imageFile.hidden=true;imageFile.setAttribute('aria-label','Alege imagini de maximum 5 MB fiecare');
 const chooseImage=node('button','Încarcă imagine'),imageAddress=node('input'),insertImage=node('button','Inserează'),cancelImage=node('button','Anulează'),imageStatus=node('p');
 chooseImage.type=insertImage.type=cancelImage.type='button';chooseImage.className='btn secondary small-btn';insertImage.className='btn small-btn';cancelImage.className='btn secondary small-btn';imageAddress.type='text';imageAddress.inputMode='url';imageAddress.placeholder='https://…';imageAddress.setAttribute('aria-label','Adresa imaginii');imageAddress.className='discussion-image-url';imageStatus.className='discussion-image-status';imageStatus.setAttribute('role','status');imagePanel.append(chooseImage,imageFile,imageAddress,insertImage,cancelImage,imageStatus);toolbar.after(imagePanel);
 closeImage=()=>{imagePanel.hidden=true;imageAddress.value='';imageStatus.textContent='';};
 const imageButton=button('Adaugă imagine','image',()=>{closeVideo();imagePanel.hidden=!imagePanel.hidden;imagePanel.dataset.mode='upload';chooseImage.hidden=!!form.closest('#conversatii')||(isReport&&form.id!=='report-form');chooseImage.disabled=!(form.id==='report-form'||window.BG3RO_EDITOR_IMAGES?.canUpload(form));if(!imagePanel.hidden)imageAddress.focus();},()=>editor.isActive('image'));
 button('Inserează imagine din URL','imageURL',()=>{closeVideo();if(!imagePanel.hidden&&imagePanel.dataset.mode==='url'){closeImage();return;}imagePanel.dataset.mode='url';imagePanel.hidden=false;chooseImage.hidden=true;imageStatus.textContent='';imageAddress.focus();});
 const videoPanel=node('div');videoPanel.className='discussion-video-panel';videoPanel.hidden=true;
 const videoAddress=node('input'),insertVideo=node('button','Inserează'),cancelVideo=node('button','Anulează'),videoStatus=node('p');videoAddress.type='text';videoAddress.inputMode='url';videoAddress.placeholder='https://www.youtube.com/watch?v=…';videoAddress.setAttribute('aria-label','Adresa videoclipului YouTube');videoAddress.className='discussion-image-url';insertVideo.type=cancelVideo.type='button';insertVideo.className='btn small-btn';cancelVideo.className='btn secondary small-btn';videoStatus.className='discussion-video-status';videoStatus.setAttribute('role','status');videoPanel.append(videoAddress,insertVideo,cancelVideo,videoStatus);toolbar.after(videoPanel);
 closeVideo=()=>{videoPanel.hidden=true;videoAddress.value='';videoStatus.textContent='';};
 const videoButton=button('Inserează videoclip YouTube','video',()=>{const open=videoPanel.hidden;closeImage();closeVideo();videoPanel.hidden=!open;if(open)videoAddress.focus();},()=>editor.isActive('youtube'));
 insertVideo.onclick=()=>{const videoId=youtubeID(videoAddress.value.trim());if(!videoId){videoStatus.textContent='Introdu un link YouTube valid.';return;}editor.view.focus();const selection=editor.state.selection,nodes=[{type:'youtube',attrs:{videoId}},{type:'paragraph'}];if(selection.node?.isAtom)editor.commands.insertContentAt(selection.to,nodes);else editor.commands.insertContent(nodes);closeVideo();};cancelVideo.onclick=()=>{closeVideo();videoButton.focus();};
 const putImage=attrs=>{editor.view.focus();const nodes=[{type:'image',attrs},{type:'paragraph'}],selection=editor.state.selection;if(selection.node?.type.name==='image')editor.commands.insertContentAt(selection.to,nodes);else editor.commands.insertContent(nodes);};
 insertImage.onclick=()=>{const src=imageURL(imageAddress.value.trim());if(!src){imageStatus.textContent='Introdu adresa https:// a unei imagini.';return;}putImage({src,alt:'Imagine atașată'});closeImage();};
 cancelImage.onclick=()=>{closeImage();imageButton.focus();};chooseImage.onclick=()=>imageFile.click();
 uploadFiles=async files=>{
  if(uploading||destroyed||form.querySelector('[type=submit]')?.disabled)return;
  if(form.id==='report-form'){const attachments=document.querySelector('#report-photo'),transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file));attachments.files=transfer.files;attachments.dispatchEvent(new Event('change'));imageFile.value='';closeImage();return;}
  if(isReport){imagePanel.hidden=false;imageStatus.textContent='Adaugă o imagine prin adresa ei https://.';return;}
  if(!window.BG3RO_EDITOR_IMAGES?.canUpload(form)){imagePanel.hidden=false;imageStatus.textContent=form.closest('#conversatii')?'Adaugă o imagine prin adresa ei https://.':'Conectează-te prin Discord pentru a încărca imagini.';return;}
  const ticket=imageEpoch,save=form.querySelector('[type=submit]');uploading=true;imagePanel.hidden=false;imageStatus.textContent='Se încarcă imaginile…';if(save)save.disabled=true;chooseImage.disabled=true;
  try{for(const file of files){const attrs=await window.BG3RO_EDITOR_IMAGES.upload(file,form);if(destroyed||ticket!==imageEpoch)return;putImage(attrs);}closeImage();}
  catch(error){if(!destroyed&&ticket===imageEpoch)imageStatus.textContent=error.message||'Imaginea nu a putut fi încărcată.';}
  finally{uploading=false;imageFile.value='';if(!destroyed){if(save)save.disabled=false;chooseImage.disabled=!window.BG3RO_EDITOR_IMAGES?.canUpload(form);}}
 };
 imageFile.onchange=()=>uploadFiles([...imageFile.files]);
 const guardImages=event=>{if(uploading){event.preventDefault();event.stopImmediatePropagation();}};form.addEventListener('submit',guardImages,true);
 const previousCleanup=cleanupListeners;cleanupListeners=()=>{previousCleanup();form.removeEventListener('submit',guardImages,true);};
 const disposeBadges=mountBadgeTools(editor,toolbar,form),previousBadgeCleanup=cleanupListeners;
 cleanupListeners=()=>{previousBadgeCleanup();disposeBadges();};
 section('Istoric');
 button('Anulează ultima modificare','undo',()=>editor.chain().focus().undo().run());
 button('Refă modificarea','redo',()=>editor.chain().focus().redo().run());
 section('Curățare');
 button('Elimină formatarea','Tx',()=>editor.chain().focus().unsetAllMarks().clearNodes().run());
 function refresh(){for(const [b,active]of controls)if(active)b.setAttribute('aria-pressed',String(active()));const defaults=getComputedStyle(editor.view.dom),color=editor.getAttributes('textStyle').color||'';for(const option of colorMenu.querySelectorAll('button'))option.setAttribute('aria-checked',String(option.dataset.color===color));colorButton.style.setProperty('--editor-selected-color',color||'currentColor');for(const {caption,menu,attribute}of selects){const fallback=attribute==='fontFamily'?defaults.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g,''):defaults.fontSize,value=editor.getAttributes('textStyle')[attribute]||'';caption.textContent=value||fallback;menu.firstElementChild.textContent=fallback+' (implicit)';for(const option of menu.querySelectorAll('button'))option.setAttribute('aria-checked',String(option.dataset.value===value));}host.classList.toggle('is-empty',editor.isEmpty);}
 window.addEventListener('resize',refresh);
 const closeMenus=()=>{closeColors();selects.forEach(picker=>picker.close());};
 const closeOnScroll=event=>{if(!colorMenu.contains(event.target))closeColors();for(const picker of selects)if(!picker.menu.contains(event.target))picker.close();};
 window.addEventListener('scroll',closeOnScroll,true);window.addEventListener('resize',closeMenus);
 cleanupResize=()=>{closeMenus();colorMenu.remove();selects.forEach(picker=>picker.menu.remove());window.removeEventListener('resize',refresh);window.removeEventListener('resize',closeMenus);window.removeEventListener('scroll',closeOnScroll,true);};
 refresh();
}
return api;
}
const mainForm=document.querySelector('#discussion-form');
if(mainForm){
 const replyForm=mainForm.cloneNode(true);replyForm.id='reply-discussion-form';replyForm.removeAttribute('data-user-form');replyForm.hidden=true;replyForm.classList.add('is-inline-reply');
 replyForm.querySelector('.discussion-identity')?.remove();
 for(const element of replyForm.querySelectorAll('[id]'))element.id='reply-'+element.id;
 for(const element of replyForm.querySelectorAll('[for]'))element.htmlFor='reply-'+element.htmlFor;
 const home=node('div');home.id='discussion-reply-home';home.hidden=true;home.append(replyForm);document.querySelector('#discussion-composer-home').append(home);
 window.BG3RO_DISCUSSION_EDITOR=mount(mainForm);
 window.BG3RO_REPLY_EDITOR=mount(replyForm,true);
 let contentSequence=0;
 window.BG3RO_MOUNT_CONTENT_EDITOR=(form,textarea,settings={})=>{
  const namespace='update-content-'+(++contentSequence)+'-',body=textarea.value,container=node('div');container.className='update-rich-editor';
  for(const selector of ['.discussion-editor-shell','.discussion-link-panel','#reply-discussion-editor-error','#reply-discussion-character-count']){
   const copy=replyForm.querySelector(selector).cloneNode(true);container.append(copy);
  }
  for(const el of container.querySelectorAll('[id]'))el.id=namespace+el.id.replace(/^reply-/,'');
  for(const el of container.querySelectorAll('[for]'))el.htmlFor=namespace+el.htmlFor.replace(/^reply-/,'');
  container.querySelector('.discussion-toolbar').replaceChildren();container.querySelector('.discussion-editor-content').replaceChildren();
  const oldId=textarea.id;textarea.id=namespace+'discussion-body';const label=form.querySelector('label[for="'+oldId+'"]');if(label)label.htmlFor=textarea.id;
  textarea.before(container);container.querySelector('textarea').replaceWith(textarea);textarea.maxLength=12000;
  const api=mount(form,false,false,namespace,{maximum:12000,label:'Conținutul actualizării',placeholder:'Scrie actualizarea…',...settings});
  if(body&&!body.startsWith(prefix))api.editor.commands.setContent(window.BG3RO_CONTENT.render(body).innerHTML);
  return api;
 };
 let reportReplySequence=0;
 window.BG3RO_CREATE_REPORT_REPLY=(container,body='',editingReport=false)=>{
  const prefix='report-answer-'+(++reportReplySequence)+'-',form=replyForm.cloneNode(true);
  form.id=prefix+'form';form.hidden=false;form.classList.add('report-inline-reply');
  for(const el of form.querySelectorAll('[id]'))el.id=prefix+el.id.replace(/^reply-/,'');
  for(const el of form.querySelectorAll('[for]'))el.htmlFor=prefix+el.htmlFor.replace(/^reply-/,'');
  form.querySelector('.post-avatar')?.remove();form.querySelector('[id$="discussion-own-name"]')?.remove();form.querySelector('[id$="reply-label"]')?.remove();
  form.querySelector('.discussion-toolbar').replaceChildren();form.querySelector('.discussion-editor-content').replaceChildren();
  const textarea=form.querySelector('[name=body]');textarea.value=body;textarea.maxLength=editingReport?6000:4000;
  const cancel=form.querySelector('[id$="cancel-reply"]');cancel.hidden=false;cancel.textContent='Anulează';
  form.querySelector('[type=submit]').textContent='Răspunde';
  if(editingReport)form.classList.add('report-inline-edit');
  container.append(form);const api=mount(form,!editingReport,editingReport,prefix);api.reset();api.editor.commands.setContent(documentFor(body));
  api.editor.view.dom.dataset.placeholder=editingReport?'Descrie eroarea de traducere…':'Scrie un răspuns…';
  return {form,api,cancel};
 };
}
const reportForm=document.querySelector('#report-form');
if(reportForm)window.BG3RO_REPORT_EDITOR=mount(reportForm,false,true);
