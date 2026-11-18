'use strict';
// Service worker: guarda todos os arquivos do app para uso sem internet.
const CACHE = 'mapas-mentais-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/util.js',
  './js/icons.js',
  './js/model.js',
  './js/layout.js',
  './js/render.js',
  './js/store.js',
  './js/export.js',
  './js/demo.js',
  './js/dialogs.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Rede primeiro: com internet, sempre a versão mais nova do app (evita abrir uma versão
  // antiga que não conhece recursos novos). Sem internet ou rede lenta, usa o cache.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fromCache = () => cache.match(req, { ignoreSearch: true })
      .then((hit) => hit || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error()));
    try {
      const res = await Promise.race([
        fetch(req, { cache: 'no-cache' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
      ]);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      return fromCache();
    }
  })());
});
