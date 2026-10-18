(() => {
  'use strict';
  const banner = document.querySelector('.project-banner');
  const video = banner?.querySelector('.banner-video');
  const image = banner?.querySelector('.banner-art');
  if (!video) return;
  const embers = banner.querySelector('.embers');
  if (embers) {
    const count = matchMedia('(max-width: 760px)').matches ? 22 : 36;
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('i');
      spark.className = 'ember';
      spark.style.setProperty('--left', `${(i * 37.7 + 8) % 100}%`);
      spark.style.setProperty('--top', `${(i * 23.3 + 10) % 100}%`);
      spark.style.setProperty('--size', `${2 + i % 3}px`);
      spark.style.setProperty('--duration', `${10 + i % 9}s`);
      spark.style.setProperty('--delay', `${-i * 1.7}s`);
      spark.style.setProperty('--drift', `${i % 2 ? -35 : 35}px`);
      spark.style.setProperty('--lift', `${-35 - i % 60}px`);
      embers.append(spark);
    }
  }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let visible = true, failed = false;
  function stopOnFailure() {
    failed = true; video.pause();
    banner.classList.remove('video-loaded');
  }
  async function syncPlayback() {
    banner.classList.toggle('animation-paused', !visible || document.hidden || motion.matches || !!connection?.saveData);
    if (motion.matches || connection?.saveData) {
      video.pause(); banner.classList.remove('video-loaded'); return;
    }
    if (failed) { video.pause(); return; }
    if (!visible || document.hidden) { video.pause(); return; }
    if (!video.src) { video.muted = true; video.src = video.dataset.src; }
    try { await video.play(); }
    catch (error) {
      // Visibility changes can interrupt a pending play without a media failure.
      if (error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') return;
      stopOnFailure();
    }
  }
  video.addEventListener('playing', () => {
    if (motion.matches || connection?.saveData) { video.pause(); return; }
    banner.classList.add('video-loaded');
  });
  video.addEventListener('error', stopOnFailure);
  function imageFallback() {
    if (image.dataset.fallback) { const fallback = image.dataset.fallback; delete image.dataset.fallback; image.src = fallback; }
    else image.hidden = true;
  }
  image?.addEventListener('error', imageFallback);
  if (image?.complete && !image.naturalWidth) imageFallback();
  motion.addEventListener('change', syncPlayback);
  connection?.addEventListener?.('change', syncPlayback);
  document.addEventListener('visibilitychange', syncPlayback);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; syncPlayback();
  }).observe(banner);
  syncPlayback();
})();
