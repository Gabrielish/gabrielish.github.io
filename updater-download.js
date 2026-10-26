(() => {
  'use strict';
  const link = document.querySelector('.updater-download');
  if (!link) return;
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const isMac = /mac/i.test(platform) || /Macintosh|Mac OS X/i.test(navigator.userAgent || '');
  const filename = isMac ? 'BG3RO-Updater-macOS.zip' : 'BG3RO-Updater.exe';
  link.href = new URL(`./assets/downloads/${filename}?v=20261026-corners2`, document.baseURI).href;
  link.download = filename;
  link.title = isMac ? 'Descarcă pentru macOS (Intel și Apple Silicon)' : 'Descarcă pentru Windows';
})();
