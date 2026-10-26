(() => {
 'use strict';
 window.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey)return;
  event.preventDefault();
  event.stopImmediatePropagation();
 },true);
})();
