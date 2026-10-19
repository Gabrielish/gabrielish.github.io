(() => {
 'use strict';
 // The former 0.8.0 release now shares the progress-based public label 0.7.9.
 // Keep immutable archive identifiers and download URLs untouched.
 const text=value=>typeof value==='string'?value.replace(/v\.?0\.8\.0\b/gi,'v0.7.9').replace(/\b0\.8\.0\b/g,'0.7.9'):value;
 const version=value=>text(String(value||'').trim()).replace(/^v\.?(0\.7\.9)$/i,'v$1');
 const key=value=>version(value).toLowerCase().replace(/^v\.?/,'');
 window.BG3RO_VERSIONS={text,version,key};
})();
