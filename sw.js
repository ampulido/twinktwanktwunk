const CACHE = 'ttt-shell-v7';
const PREFIX = 'ttt-shell-';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.add('./index.html');
    await Promise.allSettled(CORE.filter(u => u !== './index.html').map(u => cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('./index.html');
      try {
        const net = fetch(request);
        // aunque pierda la carrera del timeout, la respuesta tardía actualiza la caché
        event.waitUntil(net.then(res => (res.ok ? cache.put('./index.html', res.clone()) : null)).catch(() => {}));
        return cached
          ? await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))])
          : await net;
      } catch {
        return cached || new Response('Sin conexión', { status: 503 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } catch {
      return new Response('Recurso no disponible sin conexión', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});