const CACHE = 'plant-identifier-v21';
const MODEL_CACHE = 'plant-ai-model-v3';
const OFFLINE_ASSETS = [
  './', './index.html', './styles.css', './mobile-fix.css', './inaturalist.css', './wikipedia.css',
  './local-name-search.js?v=21', './translations-extra.js?v=21', './image-identification.js?v=21',
  './app.js?v=21', './inaturalist.js?v=21', './wikipedia.js?v=21', './install.js?v=21',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './vendor/onnxruntime-1.22.0/ort.min.js',
  './vendor/onnxruntime-1.22.0/ort-wasm-simd-threaded.jsep.mjs',
  './vendor/onnxruntime-1.22.0/ort-wasm-simd-threaded.jsep.wasm'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('plant-identifier-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  // The model has its own cache; avoid retaining a second 100 MB copy.
  if (url.pathname.endsWith('/model-int8.onnx')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Versioned scripts and the pinned runtime are immutable for this release.
    const cached = await cache.match(event.request);
    if (cached && (url.searchParams.get('v') === '21' || url.pathname.includes('/vendor/onnxruntime-1.22.0/'))) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        try { await cache.put(event.request, response.clone()); } catch {}
        return response;
      }
      if (cached && response.status >= 500) return cached;
      return response;
    } catch {
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const page = await cache.match('./index.html');
        if (page) return page;
      }
      return Response.error();
    }
  })());
});
