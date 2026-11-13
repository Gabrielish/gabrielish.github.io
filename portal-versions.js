(() => {
 'use strict';
 // Public version labels can be corrected here without changing immutable archive identifiers or download URLs.
 const text=value=>typeof value==='string'?value.replace(/v\.?0\.8\.0\b/gi,'v0.7.9').replace(/\b0\.8\.0\b/g,'0.7.9').replace(/v\.?0\.8\.29\b/gi,'v0.8.12').replace(/\b0\.8\.29\b/g,'0.8.12'):value;
 const version=value=>text(String(value||'').trim()).replace(/^v\.?(0\.7\.9)$/i,'v$1');
 const key=value=>version(value).toLowerCase().replace(/^v\.?/,'');
 window.BG3RO_VERSIONS={text,version,key};
})();
