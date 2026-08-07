/* Contacts & Referrals — app-shell service worker.

   The app HTML is network-first: whenever there's signal, you get the current
   build immediately, so a deploy never leaves a stale copy running on a device.
   Everything else (icons, manifest) is cache-first, and the cached HTML is the
   offline fallback, so the app still opens instantly with no connection.
   Supabase calls are never cached. */
const CACHE = 'ct-shell-v7';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isAppShell = (req, url) =>
  req.mode === 'navigate' ||
  url.pathname.endsWith('/') ||
  url.pathname.endsWith('/index.html');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase & friends: straight to network

  if (isAppShell(req, url)) {
    // Network-first: always run the newest build when online.
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        return (await caches.match('./index.html', { ignoreSearch: true }))
            || (await caches.match(req, { ignoreSearch: true }))
            || Response.error();
      }
    })());
    return;
  }

  // Everything else: cache-first, refreshed in the background.
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
      return res;
    }).catch(() => null);
    if (cached) { network; return cached; }
    return (await network) || Response.error();
  })());
});
