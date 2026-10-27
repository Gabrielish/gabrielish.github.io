(() => {
 'use strict';
 const key='bg3ro-cookie-preferences',version=1,lifetime=180*86400000;
 let choice=null,dialog=null;
 function read(value){try{const data=JSON.parse(value);return data?.version===version&&typeof data.analytics==='boolean'&&Number.isFinite(data.updatedAt)&&data.updatedAt<=Date.now()+60000&&Date.now()-data.updatedAt<lifetime?data:null;}catch{return null;}}
 try{choice=read(localStorage.getItem(key));}catch{}
 const allowed=()=>choice?.analytics===true;
 function sync(){if(dialog){dialog.querySelector('[data-cookie-state]').textContent=allowed()?'Activate':'Dezactivate';dialog.querySelector('[data-cookie-state]').classList.toggle('is-enabled',allowed());}}
 function announce(){sync();dispatchEvent(new CustomEvent('bg3ro:cookie-preferences',{detail:{analytics:allowed()}}));}
 function save(analytics){choice={version,analytics:analytics===true,updatedAt:Date.now()};try{localStorage.setItem(key,JSON.stringify(choice));}catch{}if(dialog?.open)dialog.close();announce();}
 function open(){if(!dialog)return;sync();if(!dialog.open)dialog.showModal();}
 window.BG3RO_COOKIES={allowsAnalytics:allowed,save,open};
 function mount(){
  dialog=document.createElement('dialog');dialog.id='cookie-dialog';dialog.className='cookie-dialog';dialog.setAttribute('aria-labelledby','cookie-title');dialog.setAttribute('aria-describedby','cookie-description');
  dialog.innerHTML='<button type="button" class="cookie-close" aria-label="Închide preferințele cookie-uri"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><h2 id="cookie-title">Cookie-uri</h2><p id="cookie-description">Folosim stocarea locală pentru funcționarea site-ului și, cu acordul tău, statistici despre utilizare. Detalii în <a href="#confidentialitate" data-cookie-privacy>politica de confidențialitate</a>.</p><section class="cookie-category"><h3>Stocare necesară</h3><p>Păstrează autentificarea, securitatea și preferințele tale. Rămâne activă pentru funcțiile pe care le folosești.</p></section><section class="cookie-category"><div class="cookie-category-heading"><h3>Statistici opționale</h3><span class="cookie-state" data-cookie-state></span></div><p>Ne ajută să numărăm accesările și descărcările traducerii. Nu folosim cookie-uri de publicitate sau servicii de analiză publicitară.</p></section><div class="cookie-actions"><button type="button" class="btn" data-cookie-all>Acceptă tot</button><button type="button" class="btn secondary" data-cookie-essential>Doar necesar</button></div>';
  const dismiss=()=>choice?dialog.close():save(false);
  document.body.append(dialog);dialog.querySelector('[data-cookie-all]').onclick=()=>save(true);dialog.querySelector('[data-cookie-essential]').onclick=()=>save(false);dialog.querySelector('.cookie-close').onclick=dismiss;dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});dialog.querySelector('[data-cookie-privacy]').onclick=()=>dialog.close();
  document.querySelectorAll('[data-cookie-settings]').forEach(button=>button.addEventListener('click',open));sync();if(!choice&&!document.querySelector('dialog[open]'))open();
 }
 addEventListener('storage',event=>{if(event.key!==key)return;choice=read(event.newValue);announce();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
