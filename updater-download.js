(() => {
  'use strict';
  const link = document.querySelector('.updater-download');
  if (!link) return;
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')||(/Mac/i.test(platform)&&navigator.maxTouchPoints>1);
  const isMac = !mobile&&(/mac/i.test(platform) || /Macintosh|Mac OS X/i.test(navigator.userAgent || ''));
  const os=isMac?'macos':!mobile&&/win/i.test(platform+' '+navigator.userAgent)?'windows':'other';
  const filename = isMac ? 'BG3RO-Updater-macOS.zip' : 'BG3RO-Updater.exe';
  link.href = new URL(`./assets/downloads/${filename}?v=20261026-decimal-progress`, document.baseURI).href;
  link.download = filename;
  link.title = isMac ? 'Descarcă pentru macOS (Intel și Apple Silicon)' : 'Descarcă pentru Windows';
  const hashes={windows:'24d1d29e3f83c420a81c71879594884277471c24867c49320bb863366553e4b4',macos:'952583b60d6d73e7ed968c968d3a19133a68d1425dffbca7a131bf60a3f363a1'};
  const make=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
  const trigger=make('button','updater-info-trigger'),tip=make('div','updater-info-popover');
  trigger.type='button';trigger.setAttribute('aria-label','Informații despre prima pornire a aplicației');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','updater-first-run');trigger.setAttribute('aria-haspopup','dialog');
  trigger.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>';
  tip.id='updater-first-run';tip.setAttribute('popover','auto');tip.setAttribute('role','dialog');tip.setAttribute('aria-label','Prima pornire a aplicației');
  const title=make('strong','',os==='windows'?'Prima pornire · Windows':os==='macos'?'Prima pornire · macOS':'Despre aplicație');
  tip.append(title,make('p','','Aplicația nu are o semnătură digitală verificată.'));
  if(os==='windows')tip.append(make('p','','Chrome poate avertiza că fișierul nu este descărcat frecvent. Această versiune are și detecții antivirus raportate: consultă analiza înainte de utilizare. Pentru scrierea în folderul jocului pot fi necesare drepturi de administrator.'));
  else if(os==='macos')tip.append(make('p','','După prima încercare de deschidere: Setări sistem → Confidențialitate și securitate → „Deschide oricum”. Permite accesul la folderul jocului dacă ți-l solicită.'));
  else tip.append(make('p','','Este disponibilă pentru Windows și macOS și necesită acces de scriere la folderul jocului. Deschide pagina pe calculator pentru pașii de pornire.'));
  const links=make('div','updater-scan-links');
  for(const target of os==='other'?['windows','macos']:[os]){const a=make('a','',os==='other'?'VirusTotal · '+(target==='windows'?'Windows':'macOS'):'Raport VirusTotal ↗');a.href='https://www.virustotal.com/gui/file/'+hashes[target]+'?nocache=1';a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
  tip.append(links,make('small','',os==='windows'?'Un avertisment pentru descărcări rare diferă de o detecție antivirus.':'Raportul macOS furnizat are alt hash decât arhiva distribuită acum; nu verifică fișierul actual.'));document.body.append(tip);document.querySelector('#updater-platform')?.append(document.createTextNode(' '),trigger);
  let timer,pointerFocus=false;
  const opened=()=>tip.matches(':popover-open');
  function place(){if(!opened())return;const r=trigger.getBoundingClientRect();tip.style.left=Math.max(10,Math.min(r.right-tip.offsetWidth,innerWidth-tip.offsetWidth-10))+'px';tip.style.top=Math.max(10,Math.min(r.top>tip.offsetHeight+18?r.top-tip.offsetHeight-8:r.bottom+8,innerHeight-tip.offsetHeight-10))+'px';}
  function open(){clearTimeout(timer);if(!opened())tip.showPopover();place();}
  function close(){clearTimeout(timer);if(opened())tip.hidePopover();}
  function leave(){clearTimeout(timer);timer=setTimeout(()=>{if(!trigger.matches(':hover')&&!tip.matches(':hover')&&!tip.contains(document.activeElement)&&document.activeElement!==trigger)close();},180);}
  trigger.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')open();});trigger.addEventListener('pointerleave',leave);tip.addEventListener('pointerenter',()=>clearTimeout(timer));tip.addEventListener('pointerleave',leave);
  trigger.addEventListener('pointerdown',()=>{pointerFocus=true;});trigger.addEventListener('focus',()=>{if(!pointerFocus)open();});trigger.addEventListener('click',()=>{pointerFocus=false;if(opened())close();else open();});trigger.addEventListener('blur',()=>{pointerFocus=false;leave();});tip.addEventListener('focusout',leave);
  tip.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(opened())));addEventListener('resize',place);addEventListener('scroll',()=>{if(opened()&&!tip.contains(document.activeElement))close();},{passive:true});
})();
