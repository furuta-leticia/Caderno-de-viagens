/* Caderno de Viagem — service worker
   Guarda o "casco" do app em cache para abrir 100% offline (cold start).
   Os DADOS ficam em localStorage/IndexedDB, não passam por aqui. */
const CACHE = 'caderno-v9';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png',
  './css/style.css', './js/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Só cuidamos dos arquivos do próprio app; mapas/links externos passam direto.
  if (new URL(req.url).origin !== location.origin) return;
  // Network-first: busca sempre a versão mais nova quando há conexão;
  // só cai pro cache (e vira offline-first de fato) se a rede falhar.
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
