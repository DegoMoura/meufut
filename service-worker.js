// Service worker mínimo do MeuFut — existe só para o navegador (Chrome/Android)
// considerar o app "instalável". Não guarda nada em cache de propósito: assim o
// app sempre carrega a versão mais nova, sem risco de alguém ficar preso numa
// versão antiga depois de uma atualização.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // cache:'no-store' força ignorar o cache HTTP do navegador em cada request — sem isso,
  // arquivos como o style.css podem ficar "presos" numa versão antiga por causa do cache
  // do próprio navegador, mesmo com o service worker não guardando nada por conta própria.
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});
