// All credentials stay in Edge Function environment variables, never in responses.
export function createUploadHandler({ env, fetch: request }) {
  const origins = new Set(['https://gabrielish.github.io', 'http://127.0.0.1:4173', 'http://localhost:4173']);
  const folder = "Baldur's Gate 3 Romanian Translate";
  const maxBytes = 20 * 1024 * 1024;
  // Supabase JS 2.118.0 sends x-client-info; keep retry/optional tracing headers
  // aligned with the SDK as well. The filename header is specific to this uploader.
  const allowedHeaders = 'authorization, apikey, content-type, x-client-info, x-file-name, x-retry-count, traceparent, tracestate, baggage';
  return async function handler(req) {
    const origin = req.headers.get('origin') || '';
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    if (origins.has(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': allowedHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
    const reply = (status, message, extra = {}) => new Response(JSON.stringify({ message, ...extra }), { status, headers });
    if (origin && !origins.has(origin)) return reply(403, 'Origine nepermisă.');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return reply(405, 'Metodă nepermisă.');
    const auth = req.headers.get('authorization') || '';
    if (!/^Bearer [^ ]+$/.test(auth)) return reply(401, 'Autentificare necesară.');
    const base = env('SUPABASE_URL'), key = env('SUPABASE_ANON_KEY');
    if (!base || !key) return reply(503, 'Configurarea serviciului este incompletă.');
    try {
      const authHeaders = { Authorization: auth, apikey: key };
      const identity = await request(`${base}/auth/v1/user`, { headers: authHeaders, signal: AbortSignal.timeout(10000) });
      if (!identity.ok) return reply(401, 'Sesiunea a expirat.');
      const user = await identity.json();
      // Exact account, confirmed by the owner; a copied display name grants nothing.
      if (user.id !== '73ce4438-cb0e-4556-8f47-33fb03532ac1') return reply(403, 'Doar proprietarul poate încărca arhive.');
      const role = await request(`${base}/rest/v1/rpc/bg3ro_is_moderator`, { method: 'POST', headers: authHeaders, signal: AbortSignal.timeout(10000) });
      if (!role.ok || await role.json() !== true) return reply(403, 'Drepturi de publicare necesare.');
      const token = (env('GITHUB_UPLOAD_TOKEN') || '').trim();
      if (!token) return reply(503, 'Încărcarea nu este activată. Configurează GITHUB_UPLOAD_TOKEN în Supabase Edge Functions Secrets.');
      let name;
      try { name = decodeURIComponent(req.headers.get('x-file-name') || ''); } catch (_) { return reply(400, 'Nume de fișier invalid.'); }
      if (!name || name.length > 180 || /[\\/\x00-\x1f\x7f]/.test(name) || !/\.(zip|7z|rar)$/i.test(name) || name.startsWith('.')) return reply(400, 'Alege o arhivă ZIP, 7z sau RAR cu un nume simplu.');
      if (Number(req.headers.get('content-length')) > maxBytes) return reply(413, 'Arhiva depășește limita de 20 MB.');
      if (!req.body) return reply(400, 'Lipsește arhiva.');
      const reader = req.body.getReader(), chunks = [];let size = 0;
      while (true) { const { done, value } = await reader.read();if (done) break;size += value.byteLength;if (size > maxBytes) { await reader.cancel();return reply(413, 'Arhiva depășește limita de 20 MB.'); }chunks.push(value); }
      const bytes = new Uint8Array(size);let offset = 0;for (const chunk of chunks) { bytes.set(chunk, offset);offset += chunk.byteLength; }
      const prefix = Array.from(bytes.slice(0, 8));
      const zip = prefix[0] === 80 && prefix[1] === 75 && ((prefix[2] === 3 && prefix[3] === 4) || (prefix[2] === 5 && prefix[3] === 6) || (prefix[2] === 7 && prefix[3] === 8));
      const rar = [82,97,114,33,26,7].every((v,i) => prefix[i] === v);
      const seven = [55,122,188,175,39,28].every((v,i) => prefix[i] === v);
      if (!( /\.zip$/i.test(name) && zip || /\.rar$/i.test(name) && rar || /\.7z$/i.test(name) && seven )) return reply(400, 'Conținutul nu corespunde unei arhive acceptate.');
      let binary = '';for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const path = `${encodeURIComponent(folder)}/${encodeURIComponent(name)}`;
      const endpoint = `https://api.github.com/repos/Gabrielish/bg3ro/contents/${path}`;
      const githubHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.object+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'BG3RO-upload' };
      // Classify upstream failures, but never return/log raw responses or credentials.
      const githubFailure = async (response, phase) => {
        let upstream = '';
        try { upstream = String((await response.json()).message || ''); } catch (_) {}
        let code = 'github_unavailable', message = `GitHub a refuzat operația (HTTP ${response.status}). Reîncearcă; arhiva nu a fost publicată.`;
        if (response.status === 401) {
          code = 'github_token_invalid'; message = 'GitHub nu acceptă tokenul: este invalid, expirat sau revocat. Înlocuiește GITHUB_UPLOAD_TOKEN în Supabase Secrets, fără să-l trimiți în chat.';
        } else if (response.status === 429 || response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(upstream))) {
          code = 'github_rate_limit'; message = 'GitHub a limitat temporar cererile. Așteaptă înainte să reîncerci încărcarea.';
        } else if (response.status === 403) {
          code = 'github_write_denied'; message = 'GitHub refuză accesul tokenului (403). La token selectează repository-ul Gabrielish/bg3ro și Contents: Read and write. Verifică și eventualele reguli ale ramurii main.';
        } else if (response.status === 404) {
          code = 'github_repository_access'; message = 'GitHub nu permite salvarea în Gabrielish/bg3ro (404). Verifică accesul tokenului la acest repository, nu doar la gabrielish.github.io, și Contents: Read and write.';
        } else if (response.status === 409) {
          code = 'github_conflict'; message = 'Fișierul sau ramura a fost modificată între timp. Reîncearcă încărcarea.';
        } else if (response.status === 422) {
          code = 'github_validation'; message = /committer|author|email/i.test(upstream)
            ? 'GitHub nu poate atribui commitul. Verifică numele și adresa de e-mail ale contului GitHub asociat tokenului (422).'
            : 'GitHub a respins salvarea (422). Verifică regulile ramurii main și numele arhivei; dacă persistă, transmite codul github_validation.';
        }
        console.warn(JSON.stringify({ event: 'bg3ro_upload_github_error', phase, github_status: response.status, code }));
        return reply(response.status === 409 ? 409 : 502, message, { code, github_status: response.status });
      };
      const existing = await request(`${endpoint}?ref=main`, { headers: githubHeaders, signal: AbortSignal.timeout(15000) });
      let sha;
      if (existing.ok) { const data = await existing.json();if (data.type !== 'file') return reply(409, 'Destinația nu este un fișier.');sha = data.sha; }
      else if (existing.status !== 404) return githubFailure(existing, 'read');
      const result = await request(endpoint, { method: 'PUT', headers: { ...githubHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Publish translation archive: ${name}`, branch: 'main', content: btoa(binary), ...(sha ? { sha } : {}) }), signal: AbortSignal.timeout(90000) });
      if (!result.ok) return githubFailure(result, 'write');
      const saved = await result.json();
      if (!/^[a-f0-9]{40}$/.test(saved.commit?.sha || '')) return reply(502, 'GitHub a salvat fișierul, dar confirmarea nu a putut fi citită. Reîncarcă arhiva înainte de publicare.');
      // Pin the download to this commit: replacement must not change historical releases.
      return reply(200, sha ? 'Arhiva a fost înlocuită pe GitHub.' : 'Arhiva a fost încărcată pe GitHub.', { file_name: name, file_bytes: size, download_url: `https://raw.githubusercontent.com/Gabrielish/bg3ro/${saved.commit.sha}/${path}`, replaced: !!sha });
    } catch (_) { return reply(502, 'Conexiunea la serviciul de încărcare nu a reușit. Reîncearcă înainte de a publica versiunea.'); }
  };
}
