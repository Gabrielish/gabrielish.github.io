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
      if(![data.nexus_downloads,data.site_downloads,data.nexus_views,data.site_views].every(v=>Number.isSafeInteger(v)&&v>=0)) throw Error();
      text('statistics-downloads',number(data.nexus_downloads+data.site_downloads));
      text('statistics-views',number(data.nexus_views+data.site_views));
    } catch (_) { /* Keep the last known totals; unavailable first loads remain dashes. */ }
  }
  let viewSent=false;
  let authReady=false, statisticsClient=null, statisticsUserId=null, isModerator=false;
  // Wait for restored Auth/moderator state; never count a signed-in admin as a guest.
  window.addEventListener('bg3ro:auth',async event=>{
    const {client,moderator,userId}=event.detail || {};
    authReady=!!client;
    statisticsClient=client;
    statisticsUserId=userId;
    isModerator=!!moderator;
    if(viewSent || !client || moderator || location.hostname!=='gabrielish.github.io') return;
    viewSent=true;
    try {
      const viewHeaders={...headers};
      if(userId){
        const {data,error}=await client.auth.getSession();
        if(error || !data.session?.access_token) return;
        viewHeaders.Authorization=`Bearer ${data.session.access_token}`;
      }
      const response=await fetch(url,{method:'POST',headers:viewHeaders,body:JSON.stringify({action:'view'}),keepalive:true});
      if(response.ok) await load();
    } catch (_) { /* Page rendering does not depend on statistics. */ }
  });
  const pending = new Set();
  document.addEventListener('click',async event=>{
    const anchor=event.target.closest?.('a[data-release-id]');
    if(!anchor || event.defaultPrevented || event.button!==0 || !event.isTrusted) return;
    if(!authReady || isModerator) return;
    const id=anchor.dataset.releaseId;
    if(pending.has(id)) return;
    pending.add(id);
    // Downloads remain native and immediate, even if telemetry is unavailable.
    try {
      const downloadHeaders={...headers};
      if(statisticsUserId){
        const {data,error}=await statisticsClient.auth.getSession();
        if(error || !data.session?.access_token) return;
        downloadHeaders.Authorization=`Bearer ${data.session.access_token}`;
      }
      if(isModerator || !authReady) return;
      const response=await fetch(url,{method:'POST',headers:downloadHeaders,keepalive:true,body:JSON.stringify({action:'download',release_id:id})});
      if(response.ok) await load();
    } catch (_) { /* The file download does not depend on statistics. */ }
    finally { setTimeout(()=>pending.delete(id),3000); }
  });
  load();
})();
