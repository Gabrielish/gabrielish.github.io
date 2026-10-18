// No personal Nexus API key needed. Only this fixed mod can be queried.
const PUBLIC_KEY = 'sb_publishable_8wgqYScl0lmXs3-x0feaIw_4z7kr4bd';
const endpoint = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed = new Set(['https://gabrielish.github.io', 'http://127.0.0.1:4173', 'http://localhost:4173']);
async function db(path: string, body?: unknown, method?: string) {
  const response = await fetch(`${endpoint}/rest/v1/${path}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error('Database unavailable');
  return response.status === 204 ? null : response.json();
}
export async function handler(req: Request) {
  const origin = req.headers.get('origin');
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin && allowed.has(origin) ? origin : 'https://gabrielish.github.io',
    'Access-Control-Allow-Headers': 'apikey, content-type, authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' };
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
  if (origin && !allowed.has(origin)) return reply({error:'Origin not allowed'},403);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  // Public, narrowly scoped API-key authentication. Privileged DB key stays server-side.
  if (req.headers.get('apikey') !== PUBLIC_KEY) return reply({error:'Invalid API key'},401);
  try {
    if (req.method === 'GET') {
      const data = await db('bg3ro_download_statistics?id=eq.1&select=*');
      return reply(data[0]);
    }
    if (req.method !== 'POST') return reply({error:'Method not allowed'},405);
    if (Number(req.headers.get('content-length') || 0) > 1024) return reply({error:'Payload too large'},413);
    const raw = await req.text();
    if (raw.length > 1024) return reply({error:'Payload too large'},413);
    const body = JSON.parse(raw);
    if (body.action === 'sync') {
      if (!await db('rpc/bg3ro_claim_nexus_sync', {})) return reply({cached:true});
      try {
        const response = await fetch('https://api.nexusmods.com/v2/graphql', {
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({query:'{ mod(modId:24379,gameId:3474){ uid downloads } }'}),
          signal:AbortSignal.timeout(15000),
        });
        if (!response.ok) throw Error('Nexus unavailable');
        const result = await response.json(), mod = result.data?.mod;
        if (result.errors || mod?.uid !== '14920716410683' || !Number.isSafeInteger(mod.downloads) || mod.downloads < 0) throw Error('Invalid Nexus response');
        await db('bg3ro_download_statistics?id=eq.1', {nexus_downloads:mod.downloads, downloads_synced_at:new Date().toISOString(),sync_ok:true},'PATCH');
        return reply({synced:true,downloads:mod.downloads});
      } catch (_) {
        await db('bg3ro_download_statistics?id=eq.1',{sync_ok:false},'PATCH');
        return reply({error:'Nexus unavailable; previous totals retained'},502);
      }
    }
    if (body.action !== 'view' && body.action !== 'download') return reply({error:'Invalid event'},400);
    if (body.action === 'download' && (typeof body.release_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.release_id))) return reply({error:'Invalid event'},400);
    let userId: string | null = null;
    if (body.action === 'view' && req.headers.has('authorization')) {
      const auth = await fetch(`${endpoint}/auth/v1/user`, {headers:{apikey:PUBLIC_KEY,Authorization:req.headers.get('authorization')!},signal:AbortSignal.timeout(10000)});
      if(!auth.ok) return reply({error:'Invalid session'},401);
      const user=await auth.json();
      if(typeof user.id!=='string' || !/^[a-f0-9-]{36}$/i.test(user.id)) return reply({error:'Invalid session'},401);
      userId=user.id;
    }
    // Platform-provided forwarding header; missing network identity never increases totals.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (!ip) return reply({counted:false});
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const digest = await crypto.subtle.sign('HMAC',key,encoder.encode(`${new Date().toISOString().slice(0,10)}:${ip}`));
    const fingerprint = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if(body.action === 'view') return reply({counted:await db('rpc/bg3ro_record_view',{p_fingerprint:fingerprint,p_user_id:userId})});
    return reply({counted:await db('rpc/bg3ro_record_download',{p_release_id:body.release_id,p_fingerprint:fingerprint})});
  } catch (_) { return reply({error:'Statistics unavailable'},503); }
}
Deno.serve(handler);
