const CACHE = 'phonedrop-shell-v1';
const SHELL = ['/', '/icon.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isShellRequest(request) {
  const url = new URL(request.url);
  return request.mode === 'navigate' || SHELL.includes(url.pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') cache.put(new URL(request.url).pathname, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(new URL(request.url).pathname);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !isShellRequest(event.request)) return;
  event.respondWith(networkFirst(event.request));
});
