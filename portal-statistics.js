(() => {
  'use strict';
  const config = window.BG3RO_CONFIG || {};
  const url = `${config.supabaseUrl}/functions/v1/bg3ro-statistics`;
  const headers = {apikey:config.supabasePublishableKey,'Content-Type':'application/json'};
  const number = value => new Intl.NumberFormat('ro-RO').format(value);
  const text = (id,value) => { const node=document.getElementById(id); if(node) node.textContent=value; };
  async function load() {
    try {
      const response = await fetch(url,{headers,signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw Error();
      const data = await response.json();
      if(![data.nexus_downloads,data.site_downloads,data.nexus_views].every(v=>Number.isSafeInteger(v)&&v>=0)) throw Error();
      text('statistics-downloads',number(data.nexus_downloads+data.site_downloads));
      text('statistics-download-sources',`${number(data.nexus_downloads)} Nexus + ${number(data.site_downloads)} din site`);
      text('statistics-views',number(data.nexus_views));
      text('statistics-views-source',`Nexus · valoare comunicată la ${new Date(data.views_observed_at+'T12:00:00Z').toLocaleDateString('ro-RO')}; nu se sincronizează automat.`);
      const date=data.downloads_synced_at && new Date(data.downloads_synced_at);
      text('statistics-sync',date ? `Descărcări Nexus: ${date.toLocaleString('ro-RO')}${!data.sync_ok || Date.now()-date.getTime()>48*3600000 ? ' · ultima valoare disponibilă' : ' · sincronizare zilnică'}.` : 'Descărcări Nexus: ultima valoare comunicată; sincronizare în așteptare.');
    } catch (_) { text('statistics-sync','Statisticile nu pot fi actualizate momentan.'); }
  }
  const pending = new Set();
  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a[data-release-id]');
    if(!anchor || event.defaultPrevented || event.button!==0 || !event.isTrusted) return;
    const id=anchor.dataset.releaseId;
    if(pending.has(id)) return;
    pending.add(id);
    // Downloads remain native and immediate, even if telemetry is unavailable.
    fetch(url,{method:'POST',headers,keepalive:true,body:JSON.stringify({action:'download',release_id:id})})
      .then(response=>{if(response.ok)return load();})
      .catch(()=>{})
      .finally(()=>{setTimeout(()=>pending.delete(id),3000);});
  });
  load();
})();
