(() => {
  'use strict';
  const config=window.BG3RO_CONFIG||{},key=config.supabasePublishableKey||'';
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.supabaseUrl||'')||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return;
  const prefix='bg3ro-public-v1:',values=new Map(),listeners=new Map(),jobs=new Map(),ttl=30*60*1000;
  const page=Math.max(0,Math.min(9999,(Number(new URL(location.href).searchParams.get('pagina'))||1)-1));
  const postFields='id,author_id,author_name,title,body,status,parent_id,created_at,is_guest,author_avatar_url,author_is_admin';
  const reportFields='id,title,body,category,platform,mod_version,game_version,status,moderator_reply,reply_author_name,reply_author_avatar_url,reply_created_at,created_at,is_public,author_name,is_guest,screenshot_path,screenshot_paths,author_avatar_url,author_is_admin,author_profile_id,reply_profile_id';
  const definitions={
    about:'bg3ro_about_sections?select=*&is_visible=eq.true&order=sort_order.asc,id.asc',
    updates:'bg3ro_project_updates?select=id,author_id,author_name,author_avatar_url,title,body,published_at,link_url,link_label,badge_label,is_visible&is_visible=eq.true&order=published_at.desc&limit=30',
    releases:'bg3ro_releases?select=*&is_visible=eq.true&is_deleted=eq.false&order=published_at.desc&limit=100',
    news:'rpc/bg3ro_release_news',
    posts:'bg3ro_discussion_posts?select='+postFields+'&status=eq.approved&parent_id=is.null&order=created_at.desc,id.desc&offset='+(page*10)+'&limit=10',
    reports:'bg3ro_bug_reports?select='+reportFields+'&is_public=eq.true&order=created_at.desc&limit=20',
    profiles:'bg3ro_profiles?select=id,display_name,avatar_url&limit=100'
  };
  const cacheKey=name=>prefix+name+(name==='posts'?':'+page:'');
  function publicOnly(name,value){
    if(!value||!Array.isArray(value.data))return null;
    const data=value.data.filter(row=>row&&typeof row==='object'&&
      (name!=='about'||row.is_visible===true)&&(name!=='updates'||row.is_visible!==false)&&
      (name!=='releases'||(row.is_visible!==false&&!row.is_deleted))&&(name!=='news'||(row.news_is_visible!==false&&!row.is_deleted))&&
      (name!=='posts'||row.status==='approved')&&(name!=='reports'||row.is_public===true));
    return {data,count:Number.isFinite(value.count)?value.count:data.length,replies:Array.isArray(value.replies)?value.replies.filter(row=>row.status==='approved'):[]};
  }
  for(const name of Object.keys(definitions))try{const saved=JSON.parse(localStorage.getItem(cacheKey(name)));if(saved&&Date.now()-saved.time<ttl&&saved.origin===config.supabaseUrl){const value=publicOnly(name,saved.value);if(value)values.set(name,value);}}catch{}
  function publish(name,value){values.set(name,value);try{const saved=JSON.stringify({time:Date.now(),origin:config.supabaseUrl,value});if(saved.length<1500000)localStorage.setItem(cacheKey(name),saved);}catch{}for(const cb of listeners.get(name)||[])cb(value);}
  async function read(path){
    // No Authorization header, cookies or user session: RLS applies as anon.
    const response=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/'+path,{headers:{apikey:key,Prefer:'count=exact'},credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Public read unavailable');const data=await response.json();if(!Array.isArray(data))throw Error('Invalid public response');
    const total=Number(response.headers.get('content-range')?.split('/')[1]);return{data,count:Number.isFinite(total)?total:data.length};
  }
  function refresh(name){
    if(jobs.has(name))return jobs.get(name);
    const job=(async()=>{try{const value=await read(definitions[name]);if(name==='posts'&&value.data.length){const ids=value.data.map(row=>row.id).filter(id=>/^[a-z0-9-]+$/i.test(id));if(ids.length){const replies=await read('bg3ro_discussion_posts?select='+postFields+'&status=eq.approved&parent_id=in.('+ids.join(',')+')&order=created_at.asc,id.asc&limit=100');value.replies=replies.data;}}const safe=publicOnly(name,value);if(safe)publish(name,safe);return safe;}catch{return values.get(name)||null;}finally{jobs.delete(name);}})();
    jobs.set(name,job);return job;
  }
  window.BG3RO_PUBLIC_DATA={
    page,
    get:name=>values.get(name)||null,
    watch(name,callback){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(callback);if(values.has(name))callback(values.get(name));return()=>listeners.get(name)?.delete(callback);},
    refresh,
    profile(id){const p=values.get('profiles')?.data.find(row=>row.id===id);const name=window.BG3RO_NAV_STATE?.load(id)?.name;return name?{...p,id,display_name:name}:p;}
  };
  for(const name of Object.keys(definitions))refresh(name);
})();
