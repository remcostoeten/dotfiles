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

function readPush(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch (error) {
    return { body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const data = readPush(event);
  event.waitUntil(
    self.registration.showNotification(data.title || 'phonedrop', {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'phonedrop',
      renotify: true,
      data: { url: data.url || '/' },
    }),
  );
});

async function openApp(url) {
  const target = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const open = windows.find((client) => client.url.startsWith(self.location.origin));
  if (open) return open.focus();
  return self.clients.openWindow(target);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openApp((event.notification.data && event.notification.data.url) || '/'));
});
